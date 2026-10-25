import asyncio
import asyncio
import json
import os
import shutil
import uuid

from bs4 import BeautifulSoup
from utils.logger import get_logger

logger = get_logger("audit_performance")

LIGHTHOUSE_PATH = shutil.which("lighthouse") or shutil.which("lighthouse.cmd")
logger.info(f"Lighthouse path: {LIGHTHOUSE_PATH}")

# Linux temporary directory.
# In Docker, mount this path as tmpfs to clear its contents on container restart.
TEMP_BASE = "/tmp"
OUTPUT_DIR = os.path.join(TEMP_BASE, "pixiaudit_lighthouse")
os.makedirs(OUTPUT_DIR, exist_ok=True)
logger.info(f"Lighthouse temporary directory: {OUTPUT_DIR}")


async def run_performance_audit(pages: list, job_id: str, config: dict) -> dict:
    thresholds = config["performance"]["thresholds"]
    strategy = config["performance"]["strategy"]

    concurrency = 3
    max_lh = config["performance"].get("max_pages_lighthouse", len(pages))

    valid_pages = [
        p for p in pages
        if p.get("status") == 200 and p.get("html")
    ]

    if not valid_pages:
        logger.warning(f"[{job_id}] No valid pages found")
        return {"job_id": job_id, "pages": [], "anomalies": []}

    if not LIGHTHOUSE_PATH:
        logger.error(f"[{job_id}] Lighthouse not found — HTML analysis only")

    lighthouse_pages = valid_pages[:max_lh]
    html_only_pages = valid_pages[max_lh:]

    logger.info(
        f"[{job_id}] Performance audit — "
        f"{len(valid_pages)} pages total — "
        f"{len(lighthouse_pages)} with Lighthouse — "
        f"{len(html_only_pages)} HTML only — "
        f"concurrency={concurrency}"
    )

    semaphore = asyncio.Semaphore(concurrency)
    lh_tasks = [
        _audit_page(page, strategy, thresholds, job_id, semaphore)
        for page in lighthouse_pages
    ]

    try:
        lh_results = await asyncio.gather(*lh_tasks, return_exceptions=True)
        lh_results = [r for r in lh_results if not isinstance(r, Exception)]
    except asyncio.CancelledError:
        logger.warning(f"[{job_id}] Performance audit cancelled")
        raise

    html_results = [
        _html_only_page(page, thresholds, job_id)
        for page in html_only_pages
    ]

    all_results = [r for r in lh_results if r] + html_results
    all_anomalies = []

    for result in all_results:
        all_anomalies.extend(result.get("anomalies", []))

    scores = [
        result["metrics"]["lighthouse_score"]
        for result in all_results
        if result.get("metrics", {}).get("lighthouse_score") is not None
    ]
    global_score = round(sum(scores) / len(scores)) if scores else None

    logger.info(
        f"[{job_id}] Performance done — "
        f"{len(all_results)} pages — "
        f"global score={global_score} — "
        f"{len(all_anomalies)} anomalies"
    )

    return {
        "job_id": job_id,
        "engine": "lighthouse+html",
        "global_score": global_score,
        "pages": all_results,
        "anomalies": all_anomalies,
    }


async def _audit_page(
    page: dict,
    strategy: str,
    thresholds: dict,
    job_id: str,
    semaphore: asyncio.Semaphore,
) -> dict:
    url = page["url"]
    html = page["html"]

    async with semaphore:
        await asyncio.sleep(2)
        logger.info(f"[{job_id}] Lighthouse + HTML → {url}")

        try:
            lh = await _run_lighthouse(url, strategy, job_id)
        except asyncio.CancelledError:
            logger.warning(f"[{job_id}] Lighthouse cancelled for {url}")
            raise

        html_result = _analyze_html(html, url)
        anomalies = []

        if lh.get("error"):
            logger.error(f"[{job_id}] Lighthouse failed on {url}: {lh['error']}")
            metrics = {
                "lighthouse_score": None,
                "lcp_ms": None,
                "ttfb_ms": None,
                "cls": None,
                "lighthouse_error": lh["error"],
            }
        elif lh.get("score") is None:
            logger.warning(f"[{job_id}] Lighthouse returned incomplete data for {url}")
            metrics = {
                "lighthouse_score": None,
                "lcp_ms": lh.get("lcp_ms"),
                "ttfb_ms": lh.get("ttfb_ms"),
                "cls": lh.get("cls"),
                "lighthouse_error": "Incomplete Lighthouse data",
            }
        else:
            metrics = {
                "lighthouse_score": lh["score"],
                "lcp_ms": lh.get("lcp_ms"),
                "ttfb_ms": lh.get("ttfb_ms"),
                "cls": lh.get("cls"),
            }
            anomalies.extend(_detect_lighthouse_anomalies(lh, thresholds, url))

        anomalies.extend(html_result["anomalies"])

        logger.info(
            f"[{job_id}] {url} → "
            f"score={metrics.get('lighthouse_score')} "
            f"lcp={metrics.get('lcp_ms')}ms "
            f"ttfb={metrics.get('ttfb_ms')}ms "
            f"html_causes={len(html_result['anomalies'])}"
        )

        return {
            "url": url,
            "type": "lighthouse+html",
            "metrics": metrics,
            "causes": html_result,
            "anomalies": anomalies,
        }


def _html_only_page(page: dict, thresholds: dict, job_id: str) -> dict:
    url = page["url"]
    html_result = _analyze_html(page["html"], url)

    logger.info(
        f"[{job_id}] HTML only → {url} — "
        f"causes={len(html_result['anomalies'])}"
    )

    return {
        "url": url,
        "type": "html-only",
        "metrics": {
            "lighthouse_score": None,
            "lcp_ms": None,
            "ttfb_ms": None,
            "cls": None,
        },
        "causes": html_result,
        "anomalies": html_result["anomalies"],
    }


async def _run_lighthouse(url: str, strategy: str, job_id: str) -> dict:
    if not LIGHTHOUSE_PATH:
        return {"error": "Lighthouse not installed"}

    run_id = uuid.uuid4().hex
    run_dir = os.path.join(OUTPUT_DIR, run_id)
    chrome_user_data = os.path.join(run_dir, "chrome")
    os.makedirs(chrome_user_data, exist_ok=True)

    try:
        chrome_flags = (
            "--headless=new "
            "--no-sandbox "
            "--disable-dev-shm-usage "
            "--disable-gpu "
            "--disable-blink-features=AutomationControlled "
            f"--user-data-dir={chrome_user_data} "
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )

        cmd = [
            LIGHTHOUSE_PATH,
            url,
            "--output",
            "json",
            "--output-path",
            "stdout",
            "--only-categories",
            "performance",
            "--form-factor",
            strategy,
            f"--chrome-flags={chrome_flags}",
            "--quiet",
        ]

        env = os.environ.copy()
        env["TMPDIR"] = run_dir
        env["TMP"] = run_dir
        env["TEMP"] = run_dir

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(), timeout=240
        )

        stderr_text = stderr.decode("utf-8", errors="replace") if stderr else ""
        stdout_text = stdout.decode("utf-8", errors="replace") if stdout else ""

        if process.returncode != 0:
            logger.error(f"[{job_id}] Lighthouse error: {stderr_text[:300]}")
            return {"error": stderr_text[:300] or "Lighthouse exited with an error"}

        if not stdout_text.strip():
            return {"error": "Lighthouse returned empty output"}

        try:
            data = json.loads(stdout_text)
            return _parse_lighthouse(data)
        except json.JSONDecodeError:
            logger.error(f"[{job_id}] Lighthouse JSON parse error")
            return {"error": "Invalid JSON from Lighthouse"}

    except asyncio.TimeoutError:
        logger.error(f"[{job_id}] Lighthouse timeout for {url}")
        return {"error": "Lighthouse timeout after 240s"}
    except asyncio.CancelledError:
        logger.warning(f"[{job_id}] Lighthouse cancelled for {url}")
        raise
    except Exception as exc:
        logger.error(f"[{job_id}] Lighthouse exception: {exc}")
        return {"error": str(exc)}
    finally:
        # Clean this audit's temporary profile and files.
        for attempt in range(3):
            try:
                if os.path.exists(run_dir):
                    shutil.rmtree(run_dir)
                break
            except (PermissionError, OSError) as exc:
                if attempt < 2:
                    await asyncio.sleep(1)
                else:
                    logger.warning(f"Could not delete {run_dir}: {exc}")


def _parse_lighthouse(data: dict) -> dict:
    cats = data.get("categories", {})
    audits = data.get("audits", {})

    score_raw = cats.get("performance", {}).get("score")
    score = int(score_raw * 100) if score_raw is not None else None
    ttfb_ms = _get_numeric(audits, "server-response-time")
    lcp_ms = _get_numeric(audits, "largest-contentful-paint")
    cls = _get_numeric(audits, "cumulative-layout-shift")

    return {
        "score": score,
        "ttfb_ms": round(ttfb_ms) if ttfb_ms is not None else None,
        "lcp_ms": round(lcp_ms) if lcp_ms is not None else None,
        "cls": round(cls, 3) if cls is not None else None,
    }


def _analyze_html(html: str, url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    imgs = soup.find_all("img")
    anomalies = []

    no_lazy = [img for img in imgs if img.get("loading") != "lazy"]
    if len(no_lazy) > 3:
        anomalies.append({
            "type": "IMAGES_WITHOUT_LAZY_LOADING",
            "detail": (
                f"{len(no_lazy)} images missing loading='lazy' "
                "— increases page load time"
            ),
            "cause": "Likely cause of high LCP",
            "value": len(no_lazy),
            "url": url,
        })

    no_size = [
        img for img in imgs
        if not img.get("width") or not img.get("height")
    ]
    if len(no_size) > 3:
        anomalies.append({
            "type": "IMAGES_WITHOUT_DIMENSIONS",
            "detail": (
                f"{len(no_size)} images missing width/height attributes "
                "— causes layout shift"
            ),
            "cause": "Likely cause of high CLS",
            "value": len(no_size),
            "url": url,
        })

    head = soup.find("head")
    if head:
        blocking = [
            script for script in head.find_all("script", src=True)
            if not script.get("async") and not script.get("defer")
        ]
        if len(blocking) > 2:
            anomalies.append({
                "type": "RENDER_BLOCKING_SCRIPTS",
                "detail": (
                    f"{len(blocking)} scripts in <head> without async/defer "
                    "— blocks page rendering"
                ),
                "cause": "Likely cause of high TTFB and FCP",
                "value": len(blocking),
                "url": url,
            })

    no_srcset = [img for img in imgs if not img.get("srcset")]
    if len(no_srcset) > 5:
        anomalies.append({
            "type": "IMAGES_WITHOUT_SRCSET",
            "detail": (
                f"{len(no_srcset)} images missing srcset "
                "— not optimized for different screen sizes"
            ),
            "cause": "Increases bandwidth usage on mobile",
            "value": len(no_srcset),
            "url": url,
        })

    return {
        "url": url,
        "imgs_total": len(imgs),
        "anomalies": anomalies,
    }


def _detect_lighthouse_anomalies(lh: dict, thresholds: dict, url: str) -> list:
    anomalies = []

    if lh.get("ttfb_ms") is not None and lh["ttfb_ms"] > thresholds["ttfb_ms"]:
        anomalies.append({
            "type": "HIGH_TTFB",
            "detail": (
                f"Server response time is {lh['ttfb_ms']}ms "
                f"(threshold: {thresholds['ttfb_ms']}ms)"
            ),
            "value": lh["ttfb_ms"],
            "threshold": thresholds["ttfb_ms"],
            "url": url,
        })

    if lh.get("lcp_ms") is not None and lh["lcp_ms"] > thresholds["lcp_ms"]:
        anomalies.append({
            "type": "HIGH_LCP",
            "detail": (
                f"Largest Contentful Paint is {lh['lcp_ms']}ms "
                f"(threshold: {thresholds['lcp_ms']}ms)"
            ),
            "value": lh["lcp_ms"],
            "threshold": thresholds["lcp_ms"],
            "url": url,
        })

    if lh.get("cls") is not None and lh["cls"] > thresholds["cls"]:
        anomalies.append({
            "type": "HIGH_CLS",
            "detail": (
                f"Cumulative Layout Shift is {lh['cls']} "
                f"(threshold: {thresholds['cls']})"
            ),
            "value": lh["cls"],
            "threshold": thresholds["cls"],
            "url": url,
        })

    return anomalies


def _get_numeric(audits: dict, key: str):
    try:
        return audits[key]["numericValue"]
    except (KeyError, TypeError):
        return None
