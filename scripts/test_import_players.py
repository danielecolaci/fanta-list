import copy
import json
from pathlib import Path
import unittest

from import_players import assign_ids, normalize_text, parse_cells, parse_role, parse_value, validate_players


class ImportTests(unittest.TestCase):
    def test_keeps_both_values_and_roles(self):
        row = parse_cells(['#1', 'D(Dc, Do)', '  Nome   À. ', ' Inter ', '14(10)', '3(4)'])
        self.assertEqual(row['roles'], ['Dc', 'Do'])
        self.assertEqual(row['name'], 'Nome À.')
        self.assertEqual(row['fvm'], {'value': 14, 'secondaryValue': 10})
        self.assertEqual(row['quotation'], {'value': 3, 'secondaryValue': 4})
        self.assertEqual(parse_value('1.000(950)'), {'value': 1000, 'secondaryValue': 950})
        self.assertEqual(parse_value('0'), {'value': 0, 'secondaryValue': None})

    def test_rejects_ambiguous_ocr_instead_of_guessing_numbers(self):
        for value in ['101)', '34)', '-3', 'NaN', '5(2', '', 'one']:
            with self.assertRaises(ValueError):
                parse_value(value)
        with self.assertRaises(ValueError):
            parse_role('D(Dc,Dc)')

    def test_ids_handle_collisions_and_role_index_resets(self):
        rows = [parse_cells(['1', 'P(Por)', 'À', 'Inter', '1(1)', '1(1)']),
                parse_cells(['2', 'P(Por)', 'A', 'Inter', '1(1)', '1(1)']),
                parse_cells(['1', 'A(Pc)', 'A', 'Inter', '1(1)', '1(1)'])]
        assign_ids(rows)
        self.assertEqual(len({p['id'] for p in rows}), 3)
        before = [p['id'] for p in rows]
        assign_ids(rows)
        self.assertEqual(before, [p['id'] for p in rows])

    def test_actual_dataset_is_complete_and_not_missing_last_rows(self):
        rows = json.loads(Path('public/data/players.json').read_text(encoding='utf-8'))
        summary = validate_players(rows)
        self.assertEqual(summary['byMacroRole'], {'P': 64, 'D': 189, 'C': 193, 'A': 86})
        self.assertEqual(summary['total'], 532)
        self.assertEqual(summary['teams'], 20)
        duplicate = copy.deepcopy(rows)
        duplicate[1]['id'] = duplicate[0]['id']
        with self.assertRaises(ValueError):
            validate_players(duplicate)
        with self.assertRaises(ValueError):
            validate_players(rows[1:])

    def test_values_visually_verified_against_pdf(self):
        rows = json.loads(Path('public/data/players.json').read_text(encoding='utf-8'))
        keyed = {(p['macroRole'], p['originalIndex']): p for p in rows}
        expected = [
            ('P', 1, 'Bijlow', 'Genoa', ['Por'], (15, 15), (8, 8)),
            ('P', 2, 'Bleve', 'Lecce', ['Por'], (1, 1), (1, 1)),
            ('P', 3, 'Butez', 'Como', ['Por'], (50, 50), (15, 15)),
            ('P', 32, 'Okoye', 'Udinese', ['Por'], (28, 28), (9, 9)),
            ('P', 62, 'Turati', 'Sassuolo', ['Por'], (1, 1), (1, 1)),
            ('P', 63, 'Vicario', 'Juventus', ['Por'], (70, 70), (17, 17)),
            ('P', 64, 'Vigorito', 'Como', ['Por'], (1, 1), (1, 1)),
            ('D', 1, 'Abankwah', 'Udinese', ['Dd', 'Dc'], (10, 12), (2, 2)),
            ('D', 2, 'Akanji', 'Inter', ['Dc'], (47, 47), (15, 15)),
            ('D', 95, 'Kelly L.', 'Juventus', ['Ds', 'Dc'], (12, 14), (5, 6)),
            ('D', 188, 'Ziolkowski', 'Monza', ['Dc'], (8, 8), (1, 1)),
            ('D', 189, 'Zortea', 'Bologna', ['Dd', 'E'], (19, 19), (7, 7)),
            ('C', 1, 'Aboukhlal', 'Torino', ['W', 'A'], (5, 4), (3, 2)),
            ('C', 2, 'Addai', 'Como', ['W', 'A'], (10, 8), (4, 4)),
            ('C', 97, 'Jones C.', 'Inter', ['C'], (47, 47), (12, 12)),
            ('C', 192, 'Zhegrova', 'Juventus', ['W'], (17, 17), (6, 5)),
            ('C', 193, 'Zielinski', 'Inter', ['C'], (45, 45), (12, 12)),
            ('A', 1, 'Adams A.', 'Venezia', ['Pc'], (35, 35), (11, 10)),
            ('A', 2, 'Adams C.', 'Torino', ['A'], (33, 33), (10, 11)),
            ('A', 43, 'Lang', 'Napoli', ['A'], (14, 14), (4, 4)),
            ('A', 85, 'Zapata D.', 'Torino', ['Pc'], (12, 10), (6, 6)),
            ('A', 86, 'Zeballos', 'Monza', ['A'], (18, 18), (6, 6)),
            # Ten additional rows sampled across the source and transcribed visually.
            ('P', 22, 'Maignan', 'Milan', ['Por'], (52, 52), (15, 15)),
            ('P', 57, 'Svilar', 'Roma', ['Por'], (85, 85), (19, 19)),
            ('D', 24, 'Bremer', 'Juventus', ['Dc'], (60, 60), (16, 16)),
            ('D', 53, 'Dimarco', 'Inter', ['E', 'W'], (240, 240), (31, 29)),
            ('D', 100, 'Kouadio', 'Monza', ['Dd', 'Dc'], (14, 10), (3, 3)),
            ('C', 26, 'Calhanoglu', 'Inter', ['M', 'C'], (243, 273), (28, 29)),
            ('C', 125, 'Mctominay', 'Napoli', ['C', 'T'], (220, 220), (27, 27)),
            ('C', 148, 'Paz N.', 'Como', ['T', 'A'], (245, 245), (29, 27)),
            ('A', 10, 'Bonny', 'Inter', ['Pc'], (15, 12), (7, 6)),
            ('A', 50, 'Malen', 'Roma', ['Pc'], (450, 450), (38, 38))
        ]
        for macro, index, name, team, roles, fvm, quotation in expected:
            with self.subTest(player=name):
                row = keyed[(macro, index)]
                self.assertEqual((row['name'], row['team'], row['roles']), (name, team, roles))
                self.assertEqual((row['fvm']['value'], row['fvm']['secondaryValue']), fvm)
                self.assertEqual((row['quotation']['value'], row['quotation']['secondaryValue']), quotation)


if __name__ == '__main__':
    unittest.main()
