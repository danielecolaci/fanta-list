"""Render the source for local OCR and visual audit; never imported by Angular."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local-tools' / 'pdf'))
import pymupdf

source = Path(sys.argv[1])
output = ROOT / '.local-tools' / 'listone-audit'
output.mkdir(parents=True, exist_ok=True)
with pymupdf.open(source) as document:
    print(f'Pagine: {len(document)}')
    for number, page in enumerate(document, 1):
        factor = min(3, 2500 / max(page.rect.width, page.rect.height))
        target = output / f'page-{number:02d}.png'
        page.get_pixmap(matrix=pymupdf.Matrix(factor, factor), alpha=False).save(target)
        page.get_pixmap(alpha=False).save(output / f'page-{number:02d}-native.png')
        print(f'{number}: {page.rect}, parole: {len(page.get_text("words"))}, immagine: {target}')
        tiles = []
        for row in range(2):
            for column in range(2):
                left = max(0, page.rect.width * column / 2 - 80)
                top = max(0, page.rect.height * row / 2 - 60)
                right = min(page.rect.width, page.rect.width * (column + 1) / 2 + 80)
                bottom = min(page.rect.height, page.rect.height * (row + 1) / 2 + 60)
                tile = output / f'page-{number:02d}-tile-{row}-{column}.png'
                clip = pymupdf.Rect(left, top, right, bottom)
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=clip, alpha=False)
                pixmap.save(tile)
                tiles.append({'image': str(tile), 'x0': int(left), 'y0': int(top),
                              'bounds': [page.rect.width * column / 2, page.rect.height * row / 2,
                                         page.rect.width * (column + 1) / 2, page.rect.height * (row + 1) / 2]})
        (output / f'page-{number:02d}-tiles.json').write_text(json.dumps(tiles), encoding='utf-8')
