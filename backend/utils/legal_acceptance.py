"""Server-controlled legal acceptance values for new customer accounts."""
from datetime import datetime, timezone


# These versions match the currently published legal pages.
CURRENT_TERMS_VERSION = "2.1"
CURRENT_PRIVACY_POLICY_VERSION = "2.0"
CUSTOMER_ACCEPTANCE_FIELD = "accepted_terms_and_privacy"


def has_customer_legal_acceptance(data):
    """Only an explicit JSON/form boolean true counts as acceptance."""
    return (data or {}).get(CUSTOMER_ACCEPTANCE_FIELD) is True


def customer_legal_acceptance_fields(now=None):
    """Return trusted values to persist on a newly created customer row."""
    accepted_at = now or datetime.now(timezone.utc)
    accepted_at_iso = accepted_at.astimezone(timezone.utc).isoformat()
    return {
        "terms_version": CURRENT_TERMS_VERSION,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "terms_accepted_at": accepted_at_iso,
        "privacy_policy_accepted_at": accepted_at_iso,
    }
