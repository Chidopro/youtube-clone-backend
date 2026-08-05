from datetime import datetime, timezone
from pathlib import Path

from flask import Flask

from routes import auth as auth_routes
from utils.legal_acceptance import (
    CURRENT_PRIVACY_POLICY_VERSION,
    CURRENT_TERMS_VERSION,
    customer_legal_acceptance_fields,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _UsersQuery:
    def __init__(self, store):
        self.store = store
        self.operation = None
        self.payload = None

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = dict(payload)
        return self

    def execute(self):
        if self.operation == "select":
            return _Result([])
        if self.operation == "insert":
            row = {"id": "customer-123", **self.payload}
            self.store.append(row)
            return _Result([row])
        raise AssertionError(f"Unexpected operation: {self.operation}")


class _FakeSupabase:
    def __init__(self):
        self.inserted_users = []

    def table(self, name):
        assert name == "users"
        return _UsersQuery(self.inserted_users)


def _test_client():
    app = Flask(__name__)
    app.config.update(TESTING=True, SECRET_KEY="test")
    fake = _FakeSupabase()
    auth_routes.auth_bp.supabase = fake
    auth_routes.auth_bp.supabase_admin = fake
    auth_routes.auth_bp.config = {}
    app.register_blueprint(auth_routes.auth_bp)
    return app.test_client(), fake


def test_server_generates_versions_and_utc_timestamp():
    fixed = datetime(2026, 8, 5, 9, 30, tzinfo=timezone.utc)
    fields = customer_legal_acceptance_fields(fixed)

    assert fields["terms_version"] == CURRENT_TERMS_VERSION
    assert fields["privacy_policy_version"] == CURRENT_PRIVACY_POLICY_VERSION
    assert fields["terms_accepted_at"] == fixed.isoformat()
    assert fields["privacy_policy_accepted_at"] == fixed.isoformat()


def test_direct_customer_registration_without_acceptance_is_rejected():
    client, fake = _test_client()

    email_only = client.post("/api/auth/signup/email-only", json={"email": "buyer@example.com"})
    password_signup = client.post(
        "/api/auth/signup",
        json={"email": "buyer@example.com", "password": "secret12"},
    )

    assert email_only.status_code == 400
    assert password_signup.status_code == 400
    assert fake.inserted_users == []


def test_successful_customer_registration_records_user_versions_and_utc_time():
    client, fake = _test_client()

    response = client.post(
        "/api/auth/signup/email-only",
        json={
            "email": "buyer@example.com",
            "accepted_terms_and_privacy": True,
        },
    )

    assert response.status_code == 200
    row = fake.inserted_users[0]
    assert row["id"] == "customer-123"
    assert row["terms_version"] == CURRENT_TERMS_VERSION
    assert row["privacy_policy_version"] == CURRENT_PRIVACY_POLICY_VERSION
    accepted_at = datetime.fromisoformat(row["terms_accepted_at"])
    assert accepted_at.tzinfo is not None
    assert accepted_at.utcoffset().total_seconds() == 0
    assert row["privacy_policy_accepted_at"] == row["terms_accepted_at"]


def test_customer_forms_start_unchecked_and_legal_links_are_current_routes():
    frontend = Path(__file__).resolve().parents[1] / "frontend" / "src"
    login = (frontend / "Pages" / "Login" / "Login.jsx").read_text(encoding="utf-8")
    modal = (frontend / "Components" / "AuthModal" / "AuthModal.jsx").read_text(encoding="utf-8")
    legacy = (frontend / "Components" / "AuthForm.jsx").read_text(encoding="utf-8")
    consent = (
        frontend
        / "Components"
        / "CustomerLegalConsent"
        / "CustomerLegalConsent.jsx"
    ).read_text(encoding="utf-8")

    assert "useState(false)" in login
    assert "useState(false)" in modal
    assert "useState(false)" in legacy
    assert 'to="/terms-of-service"' in consent
    assert 'to="/privacy-policy"' in consent
    assert "required" in consent
