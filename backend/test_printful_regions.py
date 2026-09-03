"""Unit tests for Printful ship-to region stock matching (no live API)."""
import unittest

from printful_regions import (
    au_state_code_from_postcode,
    regions_in_stock_from_availability_item,
    variant_available_for_country,
)
from printful_catalog import _storefront_size_color_base


class TestVariantAvailableForCountry(unittest.TestCase):
    def test_unknown_row_fails_open(self):
        self.assertTrue(variant_available_for_country(None, "AU"))

    def test_empty_row_not_available(self):
        self.assertFalse(variant_available_for_country(set(), "GB"))

    def test_worldwide_is_us_region_not_every_country(self):
        self.assertTrue(variant_available_for_country({"worldwide"}, "US"))
        self.assertFalse(variant_available_for_country({"worldwide"}, "DE"))
        self.assertFalse(variant_available_for_country({"worldwide"}, "AU"))
        self.assertFalse(variant_available_for_country({"worldwide"}, "GB"))

    def test_us_not_australia(self):
        stocked = {"usa", "north_america"}
        self.assertTrue(variant_available_for_country(stocked, "US"))
        self.assertTrue(variant_available_for_country(stocked, "CA"))
        self.assertFalse(variant_available_for_country(stocked, "AU"))
        self.assertFalse(variant_available_for_country(stocked, "GB"))

    def test_uk_and_europe_for_gb(self):
        self.assertTrue(variant_available_for_country({"uk"}, "GB"))
        self.assertTrue(variant_available_for_country({"europe"}, "GB"))
        self.assertTrue(variant_available_for_country({"europe"}, "DE"))
        self.assertFalse(variant_available_for_country({"uk"}, "DE"))

    def test_ireland_uses_europe_not_uk(self):
        self.assertTrue(variant_available_for_country({"europe"}, "IE"))
        self.assertFalse(variant_available_for_country({"uk"}, "IE"))
        self.assertFalse(variant_available_for_country({"usa"}, "IE"))

    def test_canada_specific(self):
        self.assertTrue(variant_available_for_country({"canada"}, "CA"))
        self.assertFalse(variant_available_for_country({"canada"}, "US"))


class TestAuStateFromPostcode(unittest.TestCase):
    def test_major_cities(self):
        self.assertEqual(au_state_code_from_postcode("2000"), "NSW")
        self.assertEqual(au_state_code_from_postcode("3000"), "VIC")
        self.assertEqual(au_state_code_from_postcode("4000"), "QLD")
        self.assertEqual(au_state_code_from_postcode("5000"), "SA")
        self.assertEqual(au_state_code_from_postcode("6000"), "WA")
        self.assertEqual(au_state_code_from_postcode("7000"), "TAS")
        self.assertEqual(au_state_code_from_postcode("2601"), "ACT")
        self.assertEqual(au_state_code_from_postcode("0800"), "NT")


class TestAvailabilityItemParse(unittest.TestCase):
    def test_any_technique_in_stock(self):
        item = {
            "catalog_variant_id": 1,
            "techniques": [
                {
                    "technique": "dtg",
                    "selling_regions": [
                        {"name": "usa", "availability": "out of stock"},
                        {"name": "australia", "availability": "in stock"},
                    ],
                }
            ],
        }
        self.assertEqual(regions_in_stock_from_availability_item(item), {"australia"})


class TestStorefrontSizeColorBase(unittest.TestCase):
    def test_uses_explicit_matrix(self):
        product = {
            "size_color_availability": {"S": ["Black"], "M": ["Black", "White"]},
            "options": {"color": ["Black", "White", "Red"], "size": ["S", "M", "L"]},
        }
        self.assertEqual(
            _storefront_size_color_base(product),
            {"S": ["Black"], "M": ["Black", "White"]},
        )

    def test_falls_back_to_options_grid(self):
        product = {"options": {"color": ["Black"], "size": ["S", "M"]}}
        self.assertEqual(
            _storefront_size_color_base(product),
            {"S": ["Black"], "M": ["Black"]},
        )


class TestBuildRegionalMatrix(unittest.TestCase):
    def test_drops_usa_only_keeps_worldwide(self):
        from unittest.mock import patch

        from printful_catalog import build_regional_size_color_availability

        product = {"size_color_availability": {"S": ["Black", "Red"]}}
        ids = {"Black": 1, "Red": 2}
        stock = {
            1: {"australia", "usa"},
            2: {"usa", "north_america", "worldwide"},
        }
        with patch(
            "printful_catalog.lookup_catalog_variant_id",
            side_effect=lambda _pid, color, _size: ids.get(color),
        ), patch(
            "printful_regions.get_variant_region_stock",
            return_value=stock,
        ):
            regional = build_regional_size_color_availability(product, 71)
        self.assertEqual(regional["AU"]["S"], ["Black"])
        self.assertEqual(regional["GB"]["S"], ["Black"])
        self.assertEqual(regional["CA"]["S"], ["Black", "Red"])


class TestRegionalBasePrices(unittest.TestCase):
    def test_min_blank_price_from_variants(self):
        from printful_regions import min_blank_price_from_catalog_prices

        payload = {
            "data": {
                "variants": [
                    {"techniques": [{"technique_key": "dtg", "price": "13.75"}]},
                    {"techniques": [{"technique_key": "dtg", "price": "11.92"}]},
                ]
            }
        }
        self.assertEqual(min_blank_price_from_catalog_prices(payload), 11.92)

    def test_prefers_dtg_over_cheaper_other_technique(self):
        from printful_regions import min_blank_price_from_catalog_prices

        payload = {
            "data": {
                "variants": [
                    {
                        "techniques": [
                            {"technique_key": "dtg", "price": "12.25"},
                            {"technique_key": "dtfilm", "price": "13.75"},
                            {"technique_key": "embroidery", "price": "10.00"},
                        ]
                    }
                ]
            }
        }
        self.assertEqual(min_blank_price_from_catalog_prices(payload), 12.25)

    def test_europe_blank_adds_to_us_retail(self):
        from unittest.mock import patch

        from printful_regions import build_regional_base_prices

        def fake_cost(_cid, country):
            return {"US": 11.92, "GB": 13.75, "IE": 13.75, "DE": 13.75, "CA": 11.92, "AU": 14.50}.get(country)

        with patch("printful_regions.get_region_blank_cost", side_effect=fake_cost):
            prices = build_regional_base_prices(21.59, 71)
        self.assertEqual(prices["US"], 21.59)
        self.assertEqual(prices["GB"], 23.42)
        self.assertEqual(prices["IE"], 23.42)
        self.assertEqual(prices["DE"], 23.42)
        self.assertEqual(prices["CA"], 21.59)
        self.assertEqual(prices["AU"], 24.17)

    def test_cheaper_region_does_not_discount_us_retail(self):
        from unittest.mock import patch

        from printful_regions import build_regional_base_prices

        with patch(
            "printful_regions.get_region_blank_cost",
            side_effect=lambda _cid, country: 9.50 if country == "CA" else 11.92,
        ):
            prices = build_regional_base_prices(21.59, 71)
        self.assertEqual(prices["CA"], 21.59)

    def test_storefront_unit_price_uses_regional_map(self):
        from printful_catalog import storefront_unit_price

        product = {
            "name": "T-Shirt",
            "price": 21.59,
            "size_pricing": {"XXL": 1.65},
            "regional_base_prices": {"US": 21.59, "GB": 23.42},
        }
        self.assertEqual(storefront_unit_price(product, "M", "GB"), 23.42)
        self.assertEqual(storefront_unit_price(product, "XXL", "GB"), 25.07)
        self.assertEqual(storefront_unit_price(product, "M", "US"), 21.59)

    def test_resolve_cart_item_prefers_catalog_over_stale_cart(self):
        from printful_catalog import resolve_cart_item_unit_price

        products = [{
            "name": "T-Shirt",
            "price": 21.59,
            "size_pricing": {"XS": 0},
            "regional_base_prices": {"US": 21.59, "GB": 23.42},
        }]
        item = {"product": "T-Shirt", "price": 21.59, "variants": {"size": "XS"}}
        self.assertEqual(resolve_cart_item_unit_price(item, products, "GB"), 23.42)


if __name__ == "__main__":
    unittest.main()
