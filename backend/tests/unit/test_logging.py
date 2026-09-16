from app.core.logging import REDACTED_VALUE, redact_sensitive_fields


def test_log_redaction_removes_sensitive_keys() -> None:
    event_dict = {
        "event": "user_signed_up",
        "phone": "+919999999999",
        "otp": "123456",
        "token": "abc.def.ghi",
        "password": "hunter2",
        "secret": "shh",
        "lat": 12.9716,
        "lon": 77.5946,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "body": "hey there",
        "photo_url": "https://cdn.example.com/photo.jpg",
        "nested": {"phone_number": "+911111111111", "safe": "ok"},
        "request_id": "11111111-1111-1111-1111-111111111111",
        "status_code": 200,
    }

    redacted = redact_sensitive_fields(None, "info", event_dict)

    for key in (
        "phone",
        "otp",
        "token",
        "password",
        "secret",
        "lat",
        "lon",
        "latitude",
        "longitude",
        "body",
        "photo_url",
    ):
        assert redacted[key] == REDACTED_VALUE

    assert redacted["nested"]["phone_number"] == REDACTED_VALUE
    assert redacted["nested"]["safe"] == "ok"
    assert redacted["event"] == "user_signed_up"
    assert redacted["request_id"] == "11111111-1111-1111-1111-111111111111"
    assert redacted["status_code"] == 200
