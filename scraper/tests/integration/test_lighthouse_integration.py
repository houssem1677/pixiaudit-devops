
import asyncio
import json
import os
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest

from audits import audit_performance


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def get_free_port():
    """Find an available local TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for_server(process, health_url, timeout=10):
    """Wait until the Lighthouse Express server is ready."""
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                "Lighthouse server exited before becoming ready"
            )

        try:
            with urllib.request.urlopen(
                health_url, timeout=1
            ) as response:
                return json.loads(response.read())
        except Exception:
            time.sleep(0.1)

    raise TimeoutError("Lighthouse server did not become ready")


@pytest.mark.asyncio
async def test_scraper_integrates_with_lighthouse_service(
    tmp_path, monkeypatch
):
    port = get_free_port()
    args_file = tmp_path / "lighthouse_args.json"
    fake_cli = tmp_path / "fake_lighthouse"

    # Fixed Lighthouse report returned by the fake CLI.
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

    # Fake executable: records CLI arguments and returns JSON.
    fake_cli.write_text(
        "#!/usr/bin/env node\n"
        "const fs = require('node:fs');\n"
        "fs.writeFileSync(\n"
        "  process.env.FAKE_ARGS_FILE,\n"
        "  JSON.stringify(process.argv.slice(2))\n"
        ");\n"
        f"process.stdout.write({json.dumps(json.dumps(report))});\n"
    )
    fake_cli.chmod(0o755)

    env = os.environ.copy()
    env.update({
        "PORT": str(port),
        "LIGHTHOUSE_BIN": str(fake_cli),
        "FAKE_ARGS_FILE": str(args_file),
    })

    # Start the real Express server.
    process = subprocess.Popen(
        ["node", str(PROJECT_ROOT / "lighthouse" / "server.js")],
        cwd=PROJECT_ROOT / "lighthouse",
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        # 1. Verify that the real service starts.
        health_url = f"http://127.0.0.1:{port}/health"

        health = await asyncio.to_thread(
            wait_for_server,
            process,
            health_url,
        )

        assert health == {
            "status": "ok",
            "service": "lighthouse",
        }

        # 2. Point the real Scraper client to the local service.
        monkeypatch.setattr(
            audit_performance,
            "LIGHTHOUSE_SERVICE_URL",
            f"http://127.0.0.1:{port}",
        )

        # 3. Send a valid audit request through the Scraper.
        result = await audit_performance._run_lighthouse(
            "https://example.test",
            "desktop",
            "integration-test",
        )

        # 4. Verify that the Scraper parsed the real HTTP response.
        assert result == {
            "score": 90,
            "ttfb_ms": 300,
            "lcp_ms": 1800,
            "cls": 0.05,
        }

        # 5. Verify the arguments received by the fake Lighthouse CLI.
        received_args = json.loads(args_file.read_text())

        assert "https://example.test" in received_args
        assert "--form-factor=desktop" in received_args

        # 6. Send an invalid URL and verify HTTP 400 handling.
        rejected = await audit_performance._run_lighthouse(
            "file:///invalid-url",
            "desktop",
            "integration-test-invalid-url",
        )

        assert "error" in rejected
        assert "400" in rejected["error"]

        # The fake CLI must not run for an invalid URL.
        assert json.loads(args_file.read_text()) == received_args

    finally:
        # Always stop the Express server.
        process.terminate()

        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

        if process.stderr:
            process.stderr.close()
