import unittest

from utils.storefront_payments import (
    storefront_online,
    storefront_payments_allowed,
    storefront_subdomain_from_origin,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, data):
        self.data = data

    def select(self, _fields):
        return self

    def eq(self, _field, _value):
        return self

    def limit(self, _count):
        return self

    def execute(self):
        return _Result(self.data)


class _Client:
    def __init__(self, data, stripe_enabled=False, storefront_offline=False):
        self.data = data
        self.stripe_enabled = stripe_enabled
        self.storefront_offline = storefront_offline
        self.storage = self

    def table(self, _name):
        return _Query(self.data)

    def from_(self, _name):
        return self

    def list(self, _folder):
        items = []
        if self.stripe_enabled:
            items.append({"name": "stripe-enabled.png"})
        if self.storefront_offline:
            items.append({"name": "storefront-offline.png"})
        return items


class StorefrontPaymentsTest(unittest.TestCase):
    def test_extracts_only_single_storefront_subdomain(self):
        self.assertEqual(
            storefront_subdomain_from_origin("https://filialsons.screenmerch.com"),
            "filialsons",
        )
        self.assertIsNone(storefront_subdomain_from_origin("https://screenmerch.com"))
        self.assertIsNone(storefront_subdomain_from_origin("https://www.screenmerch.com"))
        self.assertIsNone(storefront_subdomain_from_origin("https://evil.example"))

    def test_main_domain_is_not_gated(self):
        self.assertEqual(
            storefront_payments_allowed("https://screenmerch.com", None),
            (True, None),
        )

    def test_storefront_is_opt_in_and_fail_closed(self):
        origin = "https://newcreator.screenmerch.com"
        self.assertEqual(storefront_payments_allowed(origin, _Client([])), (False, "newcreator"))
        self.assertEqual(
            storefront_payments_allowed(origin, _Client([{"id": "creator-id"}])),
            (False, "newcreator"),
        )
        self.assertEqual(
            storefront_payments_allowed(
                origin, _Client([{"id": "creator-id"}], stripe_enabled=True)
            ),
            (True, "newcreator"),
        )

    def test_platform_storefront_uses_separate_payment_settings(self):
        origin = "https://bibleversemerch.screenmerch.com"
        self.assertEqual(
            storefront_payments_allowed(origin, _Client([], stripe_enabled=True)),
            (True, "bibleversemerch"),
        )

    def test_offline_storefront_blocks_checkout_without_deleting_settings(self):
        client = _Client(
            [{"id": "creator-id"}],
            stripe_enabled=True,
            storefront_offline=True,
        )
        self.assertFalse(storefront_online("creator-id", client))
        self.assertEqual(
            storefront_payments_allowed(
                "https://newcreator.screenmerch.com", client
            ),
            (False, "newcreator"),
        )


if __name__ == "__main__":
    unittest.main()
