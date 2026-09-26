import unittest
from pathlib import Path

from server import _extract_custom_units, _raw_units_bounds, _unit_names_from_source, add_unit_to_data


SOURCE = Path(__file__).with_name("data.js").read_bytes().decode("utf-8")


class AddUnitToDataTests(unittest.TestCase):
    def test_adds_unit_and_custom_name_without_reformatting_existing_data(self):
        updated = add_unit_to_data(SOURCE, "テストユニット", ["春日未来", "田中琴葉"])
        opening, closing = _raw_units_bounds(updated)
        names = _unit_names_from_source(updated, opening, closing)

        self.assertIn("テストユニット", names)
        self.assertEqual(_extract_custom_units(updated), [{
            "name": "テストユニット",
            "members": ["春日未来", "田中琴葉"],
        }])
        self.assertIn('"LTP02":["天海春香"', updated)
        self.assertIn("const IDOLS = {", updated)

    def test_preserves_crlf_source(self):
        crlf_source = SOURCE.replace("\r\n", "\n").replace("\n", "\r\n")
        updated = add_unit_to_data(crlf_source, "改行テスト", ["春日未来", "田中琴葉"])
        self.assertEqual(updated.count("\r\n") - crlf_source.count("\r\n"), 1)
        self.assertNotIn("\n", updated.replace("\r\n", ""))
        self.assertEqual(_extract_custom_units(updated)[0]["name"], "改行テスト")

    def test_duplicate_official_name_is_rejected(self):
        with self.assertRaises(KeyError):
            add_unit_to_data(SOURCE, "LTP02", ["春日未来", "田中琴葉"])

    def test_unknown_idol_is_rejected(self):
        with self.assertRaises(ValueError):
            add_unit_to_data(SOURCE, "テストユニット", ["春日未来", "存在しないアイドル"])

    def test_duplicate_members_are_rejected(self):
        with self.assertRaises(ValueError):
            add_unit_to_data(SOURCE, "テストユニット", ["春日未来", "春日未来"])


if __name__ == "__main__":
    unittest.main()