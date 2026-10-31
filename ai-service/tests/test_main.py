import main
from fastapi.testclient import TestClient

client = TestClient(main.app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_build_prompt_when_no_anomalies():
    data = main.AuditData(
        job_id="test-001",
        url="https://example.com",
        seo_anomalies=[],
        perf_anomalies=[],
        sec_anomalies=[],
    )

    prompt = main.build_prompt(data)

    assert "No issues were found" in prompt
    assert "professional audit report in French" in prompt


def test_build_prompt_includes_only_active_sections():
    data = main.AuditData(
        job_id="test-002",
        url="https://example.com",
        seo_anomalies=["Missing meta description"],
        perf_anomalies=[],
        sec_anomalies=["Missing security header"],
    )

    prompt = main.build_prompt(data)

    assert "### SEO" in prompt
    assert "### Securite" in prompt
    assert "### Performance" not in prompt


def test_remove_unrequested_sections():
    report = """### SEO
SEO findings.

### Performance
Performance findings.

### Sécurité
Security findings.

### Conclusion
Final conclusion.
"""

    result = main.remove_unwanted_sections(
        report,
        has_seo=True,
        has_perf=False,
        has_sec=True,
    )

    assert "### SEO" in result
    assert "### Performance" not in result
    assert "### Sécurité" in result
    assert "### Conclusion" in result

def test_recommendations_endpoint_with_mocked_ollama(monkeypatch):
    class MockResponse:
        def json(self):
            return {"response": "### Rapport d'Audit\n\nSite en bon état."}

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            self.timeout = kwargs.get("timeout")

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            assert url == main.OLLAMA_URL
            assert json["model"] == main.MODEL
            assert json["stream"] is False
            return MockResponse()

    monkeypatch.setattr(main.httpx, "AsyncClient", MockAsyncClient)
    monkeypatch.setattr(main, "log_metrics", lambda *args: None)

    response = client.post(
        "/recommendations",
        json={
            "job_id": "ci-test-001",
            "url": "https://example.com",
            "seo_anomalies": [],
            "perf_anomalies": [],
            "sec_anomalies": [],
            "analyses": ["seo_tech", "performance", "security"],
        },
    )

    assert response.status_code == 200

    result = response.json()
    assert result["job_id"] == "ci-test-001"
    assert "Rapport d'Audit" in result["recommendations"]
    assert "generation_time_seconds" in result["metrics"]
    assert "word_count" in result["metrics"]
    assert "token_count" in result["metrics"]