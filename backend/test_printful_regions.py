import os
import time
import unittest

from printful_regions import (
    au_state_code_from_postcode,
    regions_in_stock_from_availability_item,
    variant_available_for_country,
)
from printful_catalog import (
    _storefront_size_color_base,
    canonical_storefront_size,
)


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
        self.assertFalse(variant_available_for_country(stocked, "CA"))
        self.assertFalse(variant_available_for_country(stocked, "AU"))
        self.assertFalse(variant_available_for_country(stocked, "GB"))

    def test_uk_and_europe_for_gb(self):
        self.assertTrue(variant_available_for_country({"uk"}, "GB"))
        self.assertFalse(variant_available_for_country({"europe"}, "GB"))
        self.assertTrue(variant_available_for_country({"europe"}, "DE"))
        self.assertTrue(variant_available_for_country({"germany"}, "DE"))
        self.assertFalse(variant_available_for_country({"uk"}, "DE"))

    def test_ireland_uses_europe_not_uk(self):
        self.assertTrue(variant_available_for_country({"europe"}, "IE"))
        self.assertFalse(variant_available_for_country({"uk"}, "IE"))
        self.assertFalse(variant_available_for_country({"usa"}, "IE"))

    def test_canada_specific(self):
        self.assertTrue(variant_available_for_country({"canada"}, "CA"))
        self.assertFalse(variant_available_for_country({"canada"}, "US"))
        self.assertFalse(variant_available_for_country({"usa"}, "CA"))


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

    def test_dtg_oos_ignores_embroidery_stock(self):
        item = {
            "catalog_variant_id": 5310,
            "techniques": [
                {
                    "technique": "dtg",
                    "selling_regions": [
                        {"name": "usa", "availability": "in stock"},
                        {"name": "australia", "availability": "out of stock"},
                    ],
                },
                {
                    "technique": "embroidery",
                    "selling_regions": [
                        {"name": "usa", "availability": "in stock"},
                        {"name": "australia", "availability": "in stock"},
                    ],
                },
            ],
        }
        self.assertEqual(
            regions_in_stock_from_availability_item(item, ("dtg",)),
            {"usa"},
        )
        self.assertNotIn("australia", regions_in_stock_from_availability_item(item, ("dtg",)))

    def test_preferred_technique_does_not_fall_back(self):
        item = {
            "techniques": [
                {
                    "name": "Embroidery",
                    "selling_regions": [{"name": "australia", "availability": "in stock"}],
                }
            ],
        }
        self.assertEqual(regions_in_stock_from_availability_item(item, ("dtg",)), set())

    def test_v1_availability_status_maps_dashboard_regions(self):
        from printful_regions import regions_in_stock_from_v1_variant

        black_5xl = {
            "id": 12871,
            "availability_status": [
                {"region": "US", "status": "in_stock"},
                {"region": "CA", "status": "in_stock"},
            ],
        }
        black_4xl = {
            "id": 5310,
            "availability_status": [
                {"region": "US", "status": "in_stock"},
                {"region": "AU", "status": "in_stock"},
            ],
        }
        self.assertEqual(regions_in_stock_from_v1_variant(black_5xl), {"usa", "canada"})
        self.assertEqual(regions_in_stock_from_v1_variant(black_4xl), {"usa", "australia"})
        self.assertFalse(variant_available_for_country(regions_in_stock_from_v1_variant(black_5xl), "AU"))
        self.assertTrue(variant_available_for_country(regions_in_stock_from_v1_variant(black_4xl), "AU"))

    def test_unknown_stock_is_oos_for_catalog_checkout(self):
        from unittest.mock import patch

        from routes.orders import _printful_oos_cart_lines

        cart = [{"product": "T-Shirt", "color": "Black", "size": "XXXXXL"}]
        with patch("routes.orders.combo_available_for_country", return_value=None), patch(
            "routes.orders.catalog_product_id_for_product_name", return_value=71
        ):
            lines = _printful_oos_cart_lines(cart, "AU")
        self.assertEqual(lines, ["T-Shirt (Black / XXXXXL)"])


class TestCanonicalStorefrontSize(unittest.TestCase):
    def test_printful_five_xl_maps_to_storefront(self):
        self.assertEqual(canonical_storefront_size("5XL"), "XXXXXL")
        self.assertEqual(canonical_storefront_size("5xl"), "XXXXXL")
        self.assertEqual(canonical_storefront_size("XXXXXL"), "XXXXXL")
        self.assertEqual(canonical_storefront_size("XS"), "XS")
        self.assertEqual(canonical_storefront_size("15 oz"), "15 oz")


class TestCheckoutLiveStockGate(unittest.TestCase):
    def test_white_5xl_blocked_when_printful_oos(self):
        from unittest.mock import patch

        from routes.orders import _printful_oos_cart_lines, _validate_product_availability

        cart = [{
            "product": "T-Shirt",
            "color": "White",
            "size": "XXXXXL",
            "variants": {"color": "White", "size": "XXXXXL"},
        }]
        with patch("routes.orders.combo_available_for_country", return_value=False):
            lines = _printful_oos_cart_lines(cart, "US")
            ok, msg = _validate_product_availability(cart, "US")
        self.assertEqual(lines, ["T-Shirt (White / XXXXXL)"])
        self.assertFalse(ok)
        self.assertIn("out of stock", msg.lower())
        self.assertIn("White", msg)

    def test_five_xl_alias_uses_live_stock(self):
        from unittest.mock import patch

        from routes.orders import _validate_product_availability

        cart = [{"name": "T-Shirt", "color": "White", "size": "5XL"}]
        with patch("routes.orders.combo_available_for_country", return_value=False):
            ok, msg = _validate_product_availability(cart, "AU")
        self.assertFalse(ok)
        self.assertIn("Australia", msg)

    def test_in_stock_combo_still_allowed(self):
        from unittest.mock import patch

        from routes.orders import _validate_product_availability

        cart = [{"product": "T-Shirt", "color": "White", "size": "M"}]
        with patch("routes.orders.combo_available_for_country", return_value=True):
            ok, msg = _validate_product_availability(cart, "US")
        self.assertTrue(ok)
        self.assertIsNone(msg)


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
            "printful_regions.get_variant_region_stock_meta",
            return_value=(stock, True),
        ):
            regional = build_regional_size_color_availability(product, 71)
        self.assertEqual(regional["AU"]["S"], ["Black"])
        self.assertEqual(regional.get("GB") or {}, {})
        self.assertEqual(regional.get("CA") or {}, {})
        self.assertEqual(regional["US"]["S"], ["Black", "Red"])

    def test_canada_does_not_inherit_usa_stock(self):
        from unittest.mock import patch

        from printful_catalog import build_regional_size_color_availability

        product = {"size_color_availability": {"XXXXXL": ["Black", "White"]}}
        ids = {("White", "XXXXXL"): 12872, ("Black", "XXXXXL"): 12871}
        stock = {
            12871: {"usa", "canada"},
            12872: {"usa"},
        }
        with patch(
            "printful_catalog.lookup_catalog_variant_id",
            side_effect=lambda _pid, color, size: ids.get((color, size)),
        ), patch(
            "printful_regions.get_variant_region_stock_meta",
            return_value=(stock, True),
        ):
            regional = build_regional_size_color_availability(product, 71)
        self.assertEqual(regional["CA"]["XXXXXL"], ["Black"])
        self.assertNotIn("White", regional["CA"].get("XXXXXL", []))
        self.assertEqual(regional["US"]["XXXXXL"], ["Black", "White"])
        self.assertEqual(regional.get("GB") or {}, {})
        self.assertEqual(regional.get("IE") or {}, {})
        self.assertEqual(regional.get("DE") or {}, {})

    def test_us_live_stock_drops_oos_combo(self):
        from unittest.mock import patch

        from printful_catalog import build_regional_size_color_availability

        product = {"size_color_availability": {"XXXXXL": ["Black", "White"]}}
        ids = {("White", "XXXXXL"): 4012, ("Black", "XXXXXL"): 4011}
        stock = {
            4011: {"usa", "north_america"},
            4012: {"australia"},
        }
        with patch(
            "printful_catalog.lookup_catalog_variant_id",
            side_effect=lambda _pid, color, size: ids.get((color, size)),
        ), patch(
            "printful_regions.get_variant_region_stock_meta",
            return_value=(stock, True),
        ):
            regional = build_regional_size_color_availability(product, 71)
        self.assertEqual(regional["US"]["XXXXXL"], ["Black"])
        self.assertEqual(regional["AU"]["XXXXXL"], ["White"])
        self.assertNotIn("White", regional["US"].get("XXXXXL", []))


class TestComboAvailableMissingVsEmpty(unittest.TestCase):
    def test_empty_regions_is_out_of_stock(self):
        from unittest.mock import patch

        from printful_catalog import combo_available_for_country

        with patch("printful_catalog.catalog_product_id_for_product_name", return_value=71), patch(
            "printful_catalog.lookup_catalog_variant_id", return_value=4012
        ), patch(
            "printful_regions.get_variant_region_stock_meta",
            return_value=({4012: set()}, True),
        ):
            self.assertFalse(combo_available_for_country("T-Shirt", "White", "XXXXXL", "US"))

    def test_missing_variant_unknown_when_stock_incomplete(self):
        from unittest.mock import patch

        from printful_catalog import combo_available_for_country

        with patch("printful_catalog.catalog_product_id_for_product_name", return_value=71), patch(
            "printful_catalog.lookup_catalog_variant_id", return_value=4012
        ), patch(
            "printful_regions.get_variant_region_stock_meta",
            return_value=({99: {"usa"}}, False),
        ):
            self.assertIsNone(combo_available_for_country("T-Shirt", "White", "M", "US"))

    def test_missing_variant_oos_when_stock_complete(self):
        from unittest.mock import patch

        from printful_catalog import combo_available_for_country

        with patch("printful_catalog.catalog_product_id_for_product_name", return_value=71), patch(
            "printful_catalog.lookup_catalog_variant_id", return_value=4012
        ), patch(
            "printful_regions.get_variant_region_stock_meta",
            return_value=({99: {"usa"}}, True),
        ):
            self.assertFalse(combo_available_for_country("T-Shirt", "White", "M", "US"))


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


class TestCachedStockAttach(unittest.TestCase):
    def test_fetch_false_uses_cache_only(self):
        from unittest.mock import patch

        from printful_regions import _stock_cache, _stock_lock, get_variant_region_stock

        cid = 71001
        with _stock_lock:
            _stock_cache[cid] = (time.time() + 60, {12872: set()})
        try:
            with patch("printful_regions._fetch_catalog_region_stock") as fetch:
                stock = get_variant_region_stock(cid, fetch=False)
                fetch.assert_not_called()
            self.assertEqual(stock, {12872: set()})
        finally:
            with _stock_lock:
                _stock_cache.pop(cid, None)

    def test_fetch_false_miss_is_empty(self):
        from unittest.mock import patch

        from printful_regions import get_variant_region_stock

        with patch("printful_regions._fetch_catalog_region_stock") as fetch:
            stock = get_variant_region_stock(71002, fetch=False)
            fetch.assert_not_called()
        self.assertEqual(stock, {})

    def test_nonblocking_attach_uses_cached_stock(self):
        from unittest.mock import patch

        from printful_catalog import attach_printful_catalog_data

        product = {
            "name": "T-Shirt",
            "price": 21.59,
            "size_color_availability": {"XXXXXL": ["Black", "White"]},
            "printful_catalog_product_id": 71,
        }
        nested = {
            "White": {"5XL": 12872, "XXXXXL": 12872},
            "Black": {"5XL": 12871, "XXXXXL": 12871},
        }
        stock = {12871: {"usa"}, 12872: {"australia"}}
        ids = {"White": 12872, "Black": 12871}
        with patch.dict(os.environ, {"PRINTFUL_API_KEY": "test"}, clear=False), patch(
            "printful_catalog._catalog_variant_map_cached", return_value=True
        ), patch(
            "printful_catalog.get_nested_variant_map", return_value=nested
        ), patch(
            "printful_catalog.lookup_catalog_variant_id",
            side_effect=lambda _pid, color, _size: ids.get(color),
        ), patch(
            "printful_regions.get_variant_region_stock_meta", return_value=(stock, True)
        ):
            out = attach_printful_catalog_data(product, fetch_if_missing=False)
        regional = out.get("regional_size_color_availability") or {}
        self.assertEqual(regional.get("US", {}).get("XXXXXL"), ["Black"])
        self.assertEqual(regional.get("AU", {}).get("XXXXXL"), ["White"])
        self.assertNotIn("White", regional.get("US", {}).get("XXXXXL", []))


if __name__ == "__main__":
    unittest.main()
