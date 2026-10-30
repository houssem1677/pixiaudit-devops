import pytest
from unittest.mock import patch, AsyncMock

from audits.audit_security import (
    run_security_audit,
    calculate_security_score,
)


def test_valid_ssl_and_headers_score():
    ssl_result = {
        "ssl_valid": True,
        "ssl_days_remaining": 90,
    }
    headers_result = {
        "present_headers": [
            "Strict-Transport-Security",
            "Content-Security-Policy",
        ],
        "missing_headers": [],
    }

    score = calculate_security_score(ssl_result, headers_result)

    assert score == 70


def test_security_score_is_clamped_to_100():
    ssl_result = {"ssl_valid": True, "ssl_days_remaining": 90}
    headers_result = {
        "present_headers": ["H1", "H2", "H3", "H4", "H5", "H6"],
        "missing_headers": [],
    }

    score = calculate_security_score(ssl_result, headers_result)

    assert score == 100


@pytest.mark.asyncio
async def test_invalid_ssl_creates_anomaly():
    config = {
        "security": {
            "check_ssl": True,
            "check_headers": False,
            "ssl_days_warning": 30,
        }
    }

    with patch(
        "audits.audit_security._check_ssl",
        return_value={
            "ssl_valid": False,
            "ssl_error": "Certificate verification failed",
        },
    ):
        result = await run_security_audit(
            "https://example.com",
            "test-job",
            config,
        )

    assert result["ssl"]["ssl_valid"] is False
    assert result["ssl"]["anomalies"][0]["type"] == "SSL_INVALID"


@pytest.mark.asyncio
async def test_missing_security_headers_create_anomalies():
    config = {
        "security": {
            "check_ssl": False,
            "check_headers": True,
            "required_headers": [
                "Strict-Transport-Security",
                "Content-Security-Policy",
            ],
        }
    }

    with patch(
        "audits.audit_security._check_headers",
        new_callable=AsyncMock,
        return_value={
            "present_headers": ["Strict-Transport-Security"],
            "missing_headers": ["Content-Security-Policy"],
        },
    ):
        result = await run_security_audit(
            "https://example.com",
            "test-job",
            config,
        )

    assert result["headers"]["missing"] == ["Content-Security-Policy"]
    assert result["headers"]["anomalies"][0]["type"] == "MISSING_HEADER"