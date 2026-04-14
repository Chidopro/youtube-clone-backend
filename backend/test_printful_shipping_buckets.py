"""Unit tests for US table shipping floor (no Printful API calls)."""
import os
import unittest

from printful_shipping_buckets import printful_table_shipping_floor_usd, blend_api_with_table_floor


class TestPrintfulShippingBuckets(unittest.TestCase):
    def setUp(self):
        os.environ["SHIPPING_TABLE_FLOOR_ENABLED"] = "1"

    def tearDown(self):
        os.environ.pop("SHIPPING_TABLE_FLOOR_ENABLED", None)
        os.environ.pop("SHIPPING_TABLE_INCLUDE_US_HOLIDAY_40C", None)

    def test_three_shirts(self):
        cart = [{"product": "Unisex T-Shirt", "quantity": 3}]
        self.assertAlmostEqual(printful_table_shipping_floor_usd(cart, "US"), 9.15, places=2)

    def test_two_shirts_one_mug(self):
        cart = [
            {"product": "Women's Ribbed Neck", "quantity": 2},
            {"product": "Colored Mug", "quantity": 1},
        ]
        # Together shirts 4.75+2.20; mug separate 8.49
        self.assertAlmostEqual(printful_table_shipping_floor_usd(cart, "US"), 15.44, places=2)

    def test_hoodie_plus_shirt(self):
        cart = [
            {"product": "Unisex Hoodie", "quantity": 1},
            {"product": "Unisex T-Shirt", "quantity": 1},
        ]
        self.assertAlmostEqual(printful_table_shipping_floor_usd(cart, "US"), 10.69, places=2)

    def test_disabled_returns_zero_blend_passes_api(self):
        os.environ.pop("SHIPPING_TABLE_FLOOR_ENABLED", None)
        self.assertEqual(printful_table_shipping_floor_usd([{"product": "Unisex T-Shirt", "quantity": 10}], "US"), 0.0)
        self.assertEqual(blend_api_with_table_floor(3.0, [{"product": "Unisex T-Shirt", "quantity": 10}], "US"), 3.0)

    def test_non_us_no_floor(self):
        cart = [{"product": "Unisex T-Shirt", "quantity": 1}]
        self.assertEqual(printful_table_shipping_floor_usd(cart, "CA"), 0.0)

    def test_blend_maxes_api(self):
        cart = [{"product": "Colored Mug", "quantity": 1}]
        est = printful_table_shipping_floor_usd(cart, "US")
        self.assertAlmostEqual(est, 8.49, places=2)
        self.assertAlmostEqual(blend_api_with_table_floor(2.0, cart, "US"), 8.49, places=2)


if __name__ == "__main__":
    unittest.main()
