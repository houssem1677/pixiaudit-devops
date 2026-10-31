import pytest

from audits.audit_seo import run_seo_audit, calculate_seo_score


@pytest.fixture
def seo_config():
    return {
        "seo": {
            "title_min_length": 10,
            "title_max_length": 60,
            "meta_desc_min_length": 20,
            "meta_desc_max_length": 160,
            "rules": {
                "check_h1": True,
                "check_meta_description": True,
                "check_title_length": True,
                "check_canonical": True,
            },
        }
    }


@pytest.mark.asyncio
async def test_detects_missing_h1(seo_config):
    pages = [{
        "url": "https://example.com",
        "status": 200,
        "html": "<html><head><title>Valid title here</title></head></html>",
    }]

    result = await run_seo_audit(pages, "test-job", seo_config)

    anomaly_types = [
        anomaly["type"]
        for anomaly in result["results"][0]["anomalies"]
    ]

    assert "H1_MISSING" in anomaly_types


@pytest.mark.asyncio
async def test_detects_missing_meta_description(seo_config):
    pages = [{
        "url": "https://example.com",
        "status": 200,
        "html": "<html><head><title>Valid title here</title></head>"
                "<body><h1>Welcome</h1></body></html>",
    }]

    result = await run_seo_audit(pages, "test-job", seo_config)

    anomaly_types = [
        anomaly["type"]
        for anomaly in result["results"][0]["anomalies"]
    ]

    assert "META_MISSING" in anomaly_types


@pytest.mark.asyncio
async def test_detects_missing_title(seo_config):
    pages = [{
        "url": "https://example.com",
        "status": 200,
        "html": "<html><body><h1>Welcome</h1></body></html>",
    }]

    result = await run_seo_audit(pages, "test-job", seo_config)

    anomaly_types = [
        anomaly["type"]
        for anomaly in result["results"][0]["anomalies"]
    ]

    assert "TITLE_MISSING" in anomaly_types


def test_calculates_seo_score():
    results = [{
        "anomalies": [
            {"type": "H1_MISSING"},
            {"type": "META_MISSING"},
        ]
    }]

    score = calculate_seo_score(results)

    assert score == 73