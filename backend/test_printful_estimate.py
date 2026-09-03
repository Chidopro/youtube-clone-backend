"""Unit tests for Printful fulfillment tax parsing (no live API)."""
import unittest

from printful_estimate import (
    fulfillment_tax_label,
    parse_client_fulfillment_tax,
    tax_from_printful_costs,
)


class TestTaxFromPrintfulCosts(unittest.TestCase):
    def test_uk_vat_in_tax_field(self):
        self.assertEqual(tax_from_printful_costs({"tax": "3.71", "vat": "0.00"}), 3.71)

    def test_sums_tax_and_vat(self):
        self.assertEqual(tax_from_printful_costs({"tax": 1.5, "vat": 2.25}), 3.75)

    def test_missing_is_zero(self):
        self.assertEqual(tax_from_printful_costs({}), 0.0)
        self.assertEqual(tax_from_printful_costs(None), 0.0)


class TestFulfillmentTaxLabel(unittest.TestCase):
    def test_vat_countries(self):
        self.assertEqual(fulfillment_tax_label("GB"), "Fulfillment VAT")
        self.assertEqual(fulfillment_tax_label("IE"), "Fulfillment VAT")
        self.assertEqual(fulfillment_tax_label("DE"), "Fulfillment VAT")

    def test_australia_gst(self):
        self.assertEqual(fulfillment_tax_label("AU"), "Fulfillment GST")

    def test_canada_gst_hst(self):
        self.assertEqual(fulfillment_tax_label("CA"), "Fulfillment GST/HST")

    def test_us_generic(self):
        self.assertEqual(fulfillment_tax_label("US"), "Fulfillment tax")


class TestFulfillmentTaxApplies(unittest.TestCase):
    def test_vat_gst_only(self):
        from printful_estimate import fulfillment_tax_applies
        self.assertTrue(fulfillment_tax_applies("GB"))
        self.assertTrue(fulfillment_tax_applies("IE"))
        self.assertTrue(fulfillment_tax_applies("DE"))
        self.assertTrue(fulfillment_tax_applies("AU"))
        self.assertTrue(fulfillment_tax_applies("CA"))
        self.assertFalse(fulfillment_tax_applies("US"))


class TestParseClientFulfillmentTax(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(parse_client_fulfillment_tax("3.71"), 3.71)

    def test_invalid_and_negative(self):
        self.assertEqual(parse_client_fulfillment_tax(None), 0.0)
        self.assertEqual(parse_client_fulfillment_tax("nope"), 0.0)
        self.assertEqual(parse_client_fulfillment_tax(-1), 0.0)


class TestResolveCheckoutFulfillmentTax(unittest.TestCase):
    def test_falls_back_without_api(self):
        from printful_estimate import resolve_checkout_fulfillment_tax
        self.assertEqual(
            resolve_checkout_fulfillment_tax("", {"country_code": "GB"}, [], "3.71"),
            3.71,
        )


class TestEstimateRecipient(unittest.TestCase):
    def test_fills_city_and_address(self):
        from printful_estimate import recipient_for_printful_estimate
        r = recipient_for_printful_estimate({"country_code": "GB", "zip": "SW1A 1AA"})
        self.assertEqual(r["city"], "London")
        self.assertEqual(r["address1"], "Address")
        self.assertEqual(r["zip"], "SW1A 1AA")

    def test_ireland_city(self):
        from printful_estimate import recipient_for_printful_estimate
        r = recipient_for_printful_estimate({"country_code": "IE", "zip": "D02 AF30"})
        self.assertEqual(r["city"], "Dublin")


if __name__ == "__main__":
    unittest.main()
