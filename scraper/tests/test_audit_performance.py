
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from audits.audit_performance import (
    _parse_lighthouse,
    _detect_lighthouse_anomalies,
    _run_lighthouse,
    run_performance_audit,
)


def test_parses_lighthouse_metrics():
    report = {
        "categories": {
            "performance": {"score": 0.85}
        },
        "audits": {
            "server-response-time": {"numericValue": 450},
            "largest-contentful-paint": {"numericValue": 2500},
            "cumulative-layout-shift": {"numericValue": 0.12345},
        },
    }

    result = _parse_lighthouse(report)

    assert result == {
        "score": 85,
        "ttfb_ms": 450,
        "lcp_ms": 2500,
        "cls": 0.123,
    }


def test_detects_performance_threshold_violations():
    metrics = {
        "ttfb_ms": 900,
        "lcp_ms": 4000,
        "cls": 0.3,
    }

    thresholds = {
        "ttfb_ms": 500,
        "lcp_ms": 2500,
        "cls": 0.1,
    }

    anomalies = _detect_lighthouse_anomalies(
        metrics,
        thresholds,
        "https://example.com",
    )

    anomaly_types = [item["type"] for item in anomalies]

    assert set(anomaly_types) == {
        "HIGH_TTFB",
        "HIGH_LCP",
        "HIGH_CLS",
    }


@pytest.mark.asyncio
async def test_lighthouse_returns_parsed_report():
    report = {
        "categories": {
            "performance": {"score": 0.90}
        },
        "audits": {
            "server-response-time": {"numericValue": 300},
            "largest-contentful-paint": {"numericValue": 1800},
            "cumulative-layout-shift": {"numericValue": 0.05},
        },
    }

    mock_response = MagicMock()
    mock_response.is_error = False
    mock_response.json.return_value = report

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)

    mock_context = MagicMock()
    mock_context.__aenter__ = AsyncMock(return_value=mock_client)
    mock_context.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "audits.audit_performance.httpx.AsyncClient",
        return_value=mock_context,
    ):
        result = await _run_lighthouse(
            "https://example.com",
            "mobile",
            "test-job",
        )

    assert result["score"] == 90
    assert result["lcp_ms"] == 1800


@pytest.mark.asyncio
async def test_lighthouse_http_error_is_handled():
    mock_response = MagicMock()
    mock_response.is_error = True
    mock_response.status_code = 503
    mock_response.text = "Service unavailable"

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)

    mock_context = MagicMock()
    mock_context.__aenter__ = AsyncMock(return_value=mock_client)
    mock_context.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "audits.audit_performance.httpx.AsyncClient",
        return_value=mock_context,
    ):
        result = await _run_lighthouse(
            "https://example.com",
            "mobile",
            "test-job",
        )

    assert "error" in result
    assert "503" in result["error"]


@pytest.mark.asyncio
async def test_html_only_fallback_when_no_lighthouse_pages_allowed():
    pages = [
        {
            "url": "https://example.com",
            "status": 200,
            "html": (
                "<html><head><title>Test</title></head>"
                "<body></body></html>"
            ),
        }
    ]

    config = {
        "performance": {
            "thresholds": {
                "ttfb_ms": 500,
                "lcp_ms": 2500,
                "cls": 0.1,
            },
            "strategy": "mobile",
            "max_pages_lighthouse": 0,
            "lighthouse_concurrency": 2,
        }
    }

    with patch(
        "audits.audit_performance._run_lighthouse",
        new_callable=AsyncMock,
    ) as mock_lighthouse:
        result = await run_performance_audit(
            pages,
            "test-job",
            config,
        )

    mock_lighthouse.assert_not_called()
    assert result["pages"][0]["type"] == "html-only"
    assert result["global_score"] is None
