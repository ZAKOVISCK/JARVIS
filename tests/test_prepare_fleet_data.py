"""Optional XLSX converter regression: python -m unittest discover -s tests -p 'test_*.py'."""
import importlib.util
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from openpyxl import Workbook


class FleetConverterTest(unittest.TestCase):
    def test_source_mileage_is_not_rounded_and_documentary_fields_are_preserved(self):
        script = Path(__file__).resolve().parents[1] / "scripts" / "prepare-fleet-data.py"
        spec = importlib.util.spec_from_file_location("fleet_converter", script)
        converter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(converter)
        with tempfile.TemporaryDirectory(prefix="jarvis-converter-review-") as root:
            directory = Path(root)
            converter.OUTPUT = directory / "output"

            def workbook(name, headers, rows, sheet_name=None):
                book = Workbook()
                sheet = book.active
                if sheet_name:
                    sheet.title = sheet_name
                sheet.append(headers)
                for row in rows:
                    sheet.append(row)
                file = directory / name
                book.save(file)
                book.close()
                return file

            fleet = workbook("fleet.xlsx", ["PREFIXO", "ANO MODELO", "MARCA CHASSI", "MODELO CHASSI", "PLACA"], [
                [55154, 2022, "DEMO", "TESTE", "DEMO154"],
                [800, 2022, "DEMO", "TESTE", "DEMO800"],
            ], "GERAL")
            listing = workbook("listing.xlsx", ["CARRO", "DATA", "O.S.", "FICHA", "MEC", "PROVIDENCIAS", "OCORRENCIA", "DEFEITO ALEGADO"], [
                [154, date(2026, 1, 1), 123, 456, 789, "CONFERÊNCIA FICTÍCIA", "", ""],
            ])
            extract = workbook("extract.xlsx", ["CARRO", "DATA", "O.S.", "KM CHASSI", "MATERIAL", "QUANT", "FUNC.", "CLASSE/DENOMINACAO", "NUMREG"], [
                [154, date(2026, 1, 1), 123, 123.5, "FILTRO 900012", 1, 789, "FILTROS", 101],
                [55154, date(2026, 1, 2), 124, 123456, "FILTRO 900012", 1, 789, "FILTROS", 102],
                [800, date(2026, 1, 1), 125, 999, "FILTRO 900012", 1, 789, "FILTROS", 103],
            ])
            converter.build(listing, extract, fleet)
            vehicle = json.loads((converter.OUTPUT / "154.json").read_text())
            rows = {row[8]: row for row in vehicle["parts"]}
            self.assertIsNone(rows["101"][2])
            self.assertEqual(rows["102"][2], 123456)
            self.assertEqual(rows["101"][0], "2026-01-01")
            self.assertEqual(rows["101"][6], 2)
            self.assertEqual(len(vehicle["parts"]), 2)
            self.assertEqual(len(vehicle["services"]), 1)
            self.assertFalse((converter.OUTPUT / "800.json").exists())
            self.assertTrue((converter.OUTPUT / "source-manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
