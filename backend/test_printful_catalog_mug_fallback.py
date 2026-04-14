"""Mug catalog fallback: resolve variant by oz across color buckets."""
import unittest

from printful_catalog import _lookup_mug_variant_by_oz_any_color


class TestMugOzAnyColor(unittest.TestCase):
    def test_finds_11oz_when_color_bucket_wrong(self):
        nested = {
            "Pink / Black": {"11 oz": 11111, "15 oz": 22222},
            "Black / White": {"15 oz": 33333},
        }
        vid = _lookup_mug_variant_by_oz_any_color(403, "11 oz", nested)
        self.assertEqual(vid, 11111)

    def test_none_for_non_mug_catalog_id(self):
        nested = {"Black": {"M": 99}}
        self.assertIsNone(_lookup_mug_variant_by_oz_any_color(71, "11 oz", nested))


if __name__ == "__main__":
    unittest.main()
