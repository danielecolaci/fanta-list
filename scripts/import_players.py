"""Import a local listone PDF; PDF/OCR tools are never used by the Angular application."""
from __future__ import annotations

import argparse
import csv
from bisect import bisect_right
from collections import Counter
import hashlib
import json
from pathlib import Path
import random
import re
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local-tools' / 'listone-audit'
MACRO_ROLES = ('P', 'D', 'C', 'A')
SECTIONS = {'Portieri': 'P', 'Difensori': 'D', 'Centrocampisti': 'C', 'Attaccanti': 'A'}
ROLE_CASE = {role.casefold(): role for role in ('Por', 'Dc', 'Dd', 'Ds', 'Do', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc')}


def normalize_text(value: str) -> str:
    return ' '.join(unicodedata.normalize('NFC', value).replace('\u200b', '').split())


def slug(value: str) -> str:
    value = ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', value.casefold()).strip('-')


def parse_role(value: str) -> tuple[str, list[str]]:
    normalized = re.sub(r'\s+', '', value)
    match = re.fullmatch(r'([PDCA])\(([A-Za-z]+(?:,[A-Za-z]+)*)\)', normalized, re.IGNORECASE)
    if not match:
        raise ValueError(f'Ruolo non valido: {value!r}')
    roles = [ROLE_CASE.get(role.casefold(), role) for role in match[2].split(',')]
    if len(set(roles)) != len(roles):
        raise ValueError(f'Sottoruoli duplicati: {value!r}')
    return match[1].upper(), roles


def parse_value(value: str) -> dict:
    value = re.sub(r'\s+', '', value)
    number = r'(?:\d{1,3}(?:\.\d{3})+|\d+)'
    match = re.fullmatch(rf'({number})(?:\(({number})\))?', value)
    if not match:
        raise ValueError(f'Valore numerico non valido: {value!r}')
    return {
        'value': int(match[1].replace('.', '')),
        'secondaryValue': int(match[2].replace('.', '')) if match[2] is not None else None
    }


def parse_cells(cells: list[str]) -> dict:
    if len(cells) != 6:
        raise ValueError(f'Attese 6 colonne, ricevute {len(cells)}')
    original_index = re.fullmatch(r'#?\s*([1-9]\d*)', normalize_text(cells[0]))
    if not original_index:
        raise ValueError(f'Indice originale non valido: {cells[0]!r}')
    macro_role, roles = parse_role(cells[1])
    name, team = normalize_text(cells[2]), normalize_text(cells[3])
    if not name or not team:
        raise ValueError('Nome o squadra vuoti')
    return {
        'id': '', 'originalIndex': int(original_index[1]), 'name': name, 'team': team,
        'macroRole': macro_role, 'roles': roles, 'fvm': parse_value(cells[4]), 'quotation': parse_value(cells[5])
    }


def assign_ids(players: list[dict]) -> None:
    bases = [f"{p['macroRole']}-{slug(p['name'])}-{slug(p['team'])}" for p in players]
    collisions = Counter(bases)
    for player, base in zip(players, bases):
        player['id'] = f"{base}-{player['originalIndex']}" if collisions[base] > 1 else base


def validate_players(players: object, require_all_roles: bool = True) -> dict:
    if not isinstance(players, list) or not players:
        raise ValueError('Il dataset deve essere un array non vuoto')
    ids: set[str] = set()
    indices: dict[str, list[int]] = {role: [] for role in MACRO_ROLES}
    for position, player in enumerate(players, 1):
        if not isinstance(player, dict):
            raise ValueError(f'Riga {position}: oggetto Player atteso')
        for field in ('id', 'name', 'team'):
            if not isinstance(player.get(field), str) or not player[field].strip():
                raise ValueError(f'Riga {position}: {field} vuoto o non valido')
        if player['id'] in ids:
            raise ValueError(f"ID duplicato: {player['id']}")
        ids.add(player['id'])
        if player.get('macroRole') not in MACRO_ROLES:
            raise ValueError(f'Riga {position}: macro ruolo non valido')
        if not isinstance(player.get('roles'), list) or not player['roles'] or any(
            not isinstance(role, str) or not role.strip() for role in player['roles']
        ):
            raise ValueError(f'Riga {position}: sottoruoli non validi')
        if len(set(player['roles'])) != len(player['roles']):
            raise ValueError(f'Riga {position}: sottoruoli duplicati')
        index = player.get('originalIndex')
        if type(index) is not int or index < 1:
            raise ValueError(f'Riga {position}: indice originale non valido')
        indices[player['macroRole']].append(index)
        for field in ('fvm', 'quotation'):
            value = player.get(field)
            if not isinstance(value, dict) or type(value.get('value')) is not int or value['value'] < 0:
                raise ValueError(f'Riga {position}: {field} principale non valido')
            if 'secondaryValue' not in value or (value['secondaryValue'] is not None and (
                type(value['secondaryValue']) is not int or value['secondaryValue'] < 0
            )):
                raise ValueError(f'Riga {position}: {field} secondario non valido')
    for role, values in indices.items():
        if require_all_roles and not values:
            raise ValueError(f'Sezione {role} mancante')
        if sorted(values) != list(range(1, len(values) + 1)):
            raise ValueError(f'Sezione {role}: indici mancanti o duplicati: {values}')
    return {
        'total': len(players), 'byMacroRole': {role: len(indices[role]) for role in MACRO_ROLES},
        'teams': len({p['team'] for p in players}), 'roles': len({r for p in players for r in p['roles']}),
        'errors': 0
    }


def grouped_lines(words: list[dict], tolerance: float = 11) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for word in sorted(words, key=lambda w: (w['y0'], w['x0'])):
        if not lines or abs(word['y0'] - lines[-1][0]['y0']) > tolerance:
            lines.append([word])
        else:
            lines[-1].append(word)
    return [sorted(line, key=lambda word: word['x0']) for line in lines]


def read_ocr_page(number: int) -> list[dict]:
    words = []
    tiles = json.loads((LOCAL / f'page-{number:02d}-tiles.json').read_text(encoding='utf-8'))
    for tile in tiles:
        result = json.loads(Path(tile['image']).with_suffix('.json').read_text(encoding='utf-8'))
        left, top, right, bottom = tile['bounds']
        for source_word in result['words']:
            word = dict(source_word)
            for field in ('x0', 'x1'):
                word[field] += tile['x0']
            for field in ('y0', 'y1'):
                word[field] += tile['y0']
            if left <= (word['x0'] + word['x1']) / 2 < right and top <= (word['y0'] + word['y1']) / 2 < bottom:
                words.append(word)
    return words


def read_tesseract_page(number: int) -> list[dict]:
    words = []
    path = LOCAL / f'page-{number:02d}-tesseract.tsv'
    with path.open(encoding='utf-8', newline='') as handle:
        fields = ('level', 'page', 'block', 'paragraph', 'line', 'word', 'left', 'top', 'width', 'height', 'confidence', 'text')
        for row in csv.DictReader(handle, fieldnames=fields, delimiter='\t', quoting=csv.QUOTE_NONE):
            if row['level'] != '5' or not row['text'].strip():
                continue
            left, top, width, height = (int(row[key]) for key in ('left', 'top', 'width', 'height'))
            words.append({'text': row['text'], 'x0': left, 'y0': top, 'x1': left + width, 'y1': top + height})
    # The coloured section bars are better recognized by Windows OCR.
    words = [word for word in words if word['text'] not in SECTIONS]
    for word in read_ocr_page(number):
        if word['text'] in SECTIONS:
            words.append(word)
    return words


def cell_valid(column: int, value: str) -> bool:
    try:
        if column == 0:
            return bool(re.fullmatch(r'#?\s*[1-9]\d*', value))
        if column == 1:
            parse_role(value)
        elif column in (4, 5):
            parse_value(value)
        else:
            return bool(value)
        return True
    except ValueError:
        return False


def reconcile_ocr(rows: list[dict], windows_rows: list[dict]) -> None:
    disagreements = []
    for row in rows:
        nearby = [other for other in windows_rows if other['page'] == row['page'] and abs(other['y'] - row['y']) < 16]
        if not nearby:
            continue
        other = min(nearby, key=lambda candidate: abs(candidate['y'] - row['y']))
        tess = list(row['cells'])
        for column in range(6):
            win_value, tess_value = other['cells'][column], tess[column]
            if column != 0 and cell_valid(column, win_value):
                row['cells'][column] = win_value
            elif not cell_valid(column, tess_value) and cell_valid(column, win_value):
                row['cells'][column] = win_value
            if column > 0 and win_value and tess_value and re.sub(r'\s+', '', win_value).casefold() != re.sub(r'\s+', '', tess_value).casefold():
                disagreements.append({'key': row['key'], 'column': column, 'windows': win_value, 'tesseract': tess_value})
    (LOCAL / 'ocr-disagreements.json').write_text(json.dumps(disagreements, ensure_ascii=False, indent=2), encoding='utf-8')


def read_role_candidates(number: int) -> list[dict]:
    fields = ('level', 'page', 'block', 'paragraph', 'line', 'word', 'left', 'top', 'width', 'height', 'confidence', 'text')
    with (LOCAL / f'page-{number:02d}-roles.tsv').open(encoding='utf-8', newline='') as handle:
        return [{'text': row['text'], 'y': int(row['top']) / 2} for row in csv.DictReader(
            handle, fieldnames=fields, delimiter='\t', quoting=csv.QUOTE_NONE) if row['level'] == '5' and row['text'].strip()]


def restore_ocr_role(raw: str, macro: str) -> str:
    # OCR often drops parentheses and commas. Restore separators only, preserving recognized letters.
    letters = re.sub('[^A-Za-z]', '', raw).casefold()
    if not letters.startswith(macro.casefold()):
        raise ValueError(f'Ruolo OCR non riconoscibile: {raw}')
    letters = letters[1:]
    roles = []
    while letters:
        token = next((key for key in sorted(ROLE_CASE, key=len, reverse=True) if letters.startswith(key)), None)
        if token is None:
            raise ValueError(f'Sottoruolo OCR non riconoscibile: {raw}')
        roles.append(ROLE_CASE[token])
        letters = letters[len(token):]
    result = f'{macro}({",".join(roles)})'
    parse_role(result)
    return result


def extract_rows(pages: list[list[dict]]) -> tuple[list[dict], set[str]]:
    rows = []
    sections: set[str] = set()
    active_section = None
    boundaries = None
    for page_number, words in enumerate(pages, 1):
        page_row = 0
        for line in grouped_lines(words):
            text = normalize_text(' '.join(word['text'] for word in line))
            section = next((name for name in SECTIONS if text.casefold() == name.casefold()), None)
            if section:
                active_section = SECTIONS[section]
                sections.add(active_section)
                continue
            by_text = {word['text'].casefold().rstrip('.'): word for word in line}
            if all(column in by_text for column in ('nome', 'squadra', 'fvm', 'quot')):
                role_header = by_text.get('r')
                if not role_header:
                    raise ValueError(f'Pagina {page_number}: intestazione R. non riconosciuta')
                boundaries = [role_header['x0'] - 12] + [by_text[column]['x0'] - 12 for column in ('nome', 'squadra', 'fvm', 'quot')]
                continue
            if boundaries is None:
                continue
            columns: list[list[str]] = [[] for _ in range(6)]
            for word in line:
                columns[bisect_right(boundaries, word['x0'])].append(word['text'])
            cells = [normalize_text(' '.join(column)) for column in columns]
            if sum(bool(cell) for cell in cells) < 3:
                continue
            # Page mastheads are outside the table and repeat at every page break.
            if 'listone' in text.casefold() or 'www.fantacalcio' in text.casefold():
                continue
            page_row += 1
            rows.append({'key': f'p{page_number:02d}-r{page_row:03d}', 'page': page_number,
                         'y': round(min(w['y0'] for w in line)), 'section': active_section, 'cells': cells})
    return rows, sections


def sample_rows(rows: list[dict], players: list[dict]) -> list[dict]:
    chosen: set[int] = set()
    for role in MACRO_ROLES:
        positions = [i for i, player in enumerate(players) if player['macroRole'] == role]
        chosen.update(positions[:3] + positions[-3:])
        middle = len(positions) // 2
        chosen.update(positions[max(0, middle - 1):middle + 2])
    chosen.update(random.Random(202627).sample(range(len(players)), min(10, len(players))))
    return [{'source': rows[index], 'player': players[index]} for index in sorted(chosen)]


def import_pdf(source: Path, output: Path, reuse_ocr: bool, corrections_path: Path) -> None:
    if not source.is_file():
        raise ValueError(f'PDF non trovato: {source}')
    sys.path.insert(0, str(ROOT / '.local-tools' / 'pdf'))
    try:
        import pymupdf
    except ImportError as error:
        raise ValueError('Installare i tool locali: python -m pip install --target .local-tools/pdf -r scripts/requirements.txt') from error
    LOCAL.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    manifest = LOCAL / 'ocr-source.json'
    pages = []
    with pymupdf.open(source) as document:
        has_text = all(len(page.get_text('words')) > 20 for page in document)
        if has_text:
            pages = [[dict(zip(('x0', 'y0', 'x1', 'y1', 'text'), word[:5])) for word in page.get_text('words')] for page in document]
        else:
            if reuse_ocr:
                if not manifest.exists() or json.loads(manifest.read_text(encoding='utf-8')).get('sourceSha256') != source_hash:
                    raise ValueError('Cache OCR assente o appartenente a un altro PDF: eseguire senza --reuse-ocr')
            if not reuse_ocr:
                if sys.platform != 'win32':
                    raise ValueError('PDF immagine: eseguire OCR locale con OCRmyPDF/Tesseract e importare il PDF ricercabile, oppure usare Windows OCR.')
                subprocess.run([sys.executable, str(ROOT / 'scripts' / 'inspect_pdf.py'), str(source)], check=True)
                for tile in sorted(LOCAL.glob('page-*-tile-*.png')):
                    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                                    str(ROOT / 'scripts' / 'ocr-page.ps1'), '-ImagePath', str(tile),
                                    '-OutputPath', str(tile.with_suffix('.json'))], check=True)
                subprocess.run(['node', str(ROOT / 'scripts' / 'ocr-tesseract.mjs'), str(len(document))], cwd=ROOT, check=True)
                subprocess.run([sys.executable, str(ROOT / 'scripts' / 'render-roles.py'), str(source.resolve())], cwd=ROOT, check=True)
                subprocess.run(['node', str(ROOT / 'scripts' / 'ocr-roles.mjs'), str(len(document))], cwd=ROOT, check=True)
                manifest.write_text(json.dumps({'sourceSha256': source_hash, 'pages': len(document)}), encoding='utf-8')
            pages = [read_tesseract_page(number) for number in range(1, len(document) + 1)]
    rows, sections = extract_rows(pages)
    if not has_text:
        windows_rows, _ = extract_rows([read_ocr_page(number) for number in range(1, len(pages) + 1)])
        reconcile_ocr(rows, windows_rows)
        role_pages = {number: read_role_candidates(number) for number in range(1, len(pages) + 1)}
        for row in rows:
            candidates = [word for word in role_pages[row['page']] if abs(word['y'] - row['y']) < 18]
            if candidates:
                candidate = min(candidates, key=lambda word: abs(word['y'] - row['y']))
                try:
                    row['cells'][1] = restore_ocr_role(candidate['text'], row['section'])
                except ValueError:
                    pass  # An unreadable role is rejected below and requires an audited correction.
    (LOCAL / 'raw-rows.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if sections != set(MACRO_ROLES):
        raise ValueError(f'Non riconosciute tutte le sezioni: {sorted(sections)}')
    corrections = json.loads(corrections_path.read_text(encoding='utf-8')) if corrections_path.exists() else {}
    if corrections and corrections.get('sourceSha256') != source_hash:
        raise ValueError('Le correzioni OCR appartengono a un PDF diverso: verificare sourceSha256')
    overrides = corrections.get('rows', {})
    if set(overrides) - {row['key'] for row in rows}:
        raise ValueError('Correzioni OCR riferite a righe inesistenti')
    players = []
    errors = []
    for row in rows:
        cells = list(row['cells'])
        if row['key'] in overrides:
            correction = overrides[row['key']]
            if not correction.get('reason'):
                raise ValueError(f"Correzione {row['key']} priva di motivazione")
            for column, value in correction['cells'].items():
                cells[int(column)] = value
        try:
            player = parse_cells(cells)
            if player['macroRole'] != row['section']:
                raise ValueError(f"Ruolo {player['macroRole']} incoerente con sezione {row['section']}")
            players.append(player)
        except ValueError as error:
            errors.append(f"{row['key']} (pagina {row['page']}, y={row['y']}): {error}; {cells}")
    if errors:
        raise ValueError('\n'.join(errors))
    assign_ids(players)
    summary = validate_players(players)
    if corrections.get('expectedCounts') and summary['byMacroRole'] != corrections['expectedCounts']:
        raise ValueError('Conteggi diversi dal controllo visivo della sorgente: importazione interrotta')
    report = {'source': source.name, 'sourceSha256': source_hash, 'method': 'embedded-text' if has_text else 'Windows.Media.Ocr + Tesseract 7.0.0 + visual corrections',
              'summary': summary, 'correctedRows': len(overrides), 'manualAudit': 'See scripts/DATASET_AUDIT.md',
              'sample': sample_rows(rows, players)}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(players, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(output)
    (ROOT / 'scripts' / 'dataset-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print_summary(summary)
    print(f'JSON: {output}')


def print_summary(summary: dict) -> None:
    print(f"Totale giocatori: {summary['total']}")
    for label, role in SECTIONS.items():
        print(f"{label}: {summary['byMacroRole'][role]}")
    print(f"Squadre: {summary['teams']}\nSottoruoli: {summary['roles']}\nErrori dataset: {summary['errors']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', nargs='?', type=Path, default=ROOT / 'public' / 'data' / 'lista.pdf')
    parser.add_argument('--output', type=Path, default=ROOT / 'public' / 'data' / 'players.json')
    parser.add_argument('--reuse-ocr', action='store_true', help='Riutilizza solo OCR già estratto e verificato dallo stesso PDF')
    parser.add_argument('--corrections', type=Path, default=ROOT / 'scripts' / 'ocr-corrections.json')
    parser.add_argument('--validate', type=Path, help='Valida un JSON esistente senza PyMuPDF né OCR')
    args = parser.parse_args()
    try:
        if args.validate:
            print_summary(validate_players(json.loads(args.validate.read_text(encoding='utf-8'))))
        else:
            import_pdf(args.source, args.output, args.reuse_ocr, args.corrections)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Importazione fallita: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
