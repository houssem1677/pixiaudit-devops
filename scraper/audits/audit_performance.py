
import asyncio
import os

import httpx
from bs4 import BeautifulSoup
from utils.logger import get_logger

logger = get_logger("audit_performance")

LIGHTHOUSE_SERVICE_URL = os.getenv(
    "LIGHTHOUSE_SERVICE_URL",
    "http://lighthouse:8003",
).rstrip("/")

LIGHTHOUSE_TIMEOUT_SECONDS = 240


async def run_performance_audit(pages: list, job_id: str, config: dict) -> dict:
    performance_config = config["performance"]
    thresholds = performance_config["thresholds"]
    strategy = performance_config["strategy"]

    concurrency = max(
        1,
        int(performance_config.get("lighthouse_concurrency", 3)),
    )
    max_lh = max(
        0,
        int(performance_config.get("max_pages_lighthouse", len(pages))),
    )

    valid_pages = [
        page for page in pages
        if page.get("status") == 200 and page.get("html")
    ]

    if not valid_pages:
        logger.warning(f"[{job_id}] No valid pages found")
        return {
            "job_id": job_id,
            "pages": [],
            "anomalies": [],
        }

    lighthouse_pages = valid_pages[:max_lh]
    html_only_pages = valid_pages[max_lh:]

    logger.info(
        f"[{job_id}] Performance audit — "
        f"{len(valid_pages)} valid pages — "
        f"{len(lighthouse_pages)} sent to Lighthouse — "
        f"{len(html_only_pages)} HTML only — "
        f"concurrency={concurrency}"
    )

    semaphore = asyncio.Semaphore(concurrency)

    tasks = [
        _audit_page(
            page,
            strategy,
            thresholds,
            job_id,
            semaphore,
        )
        for page in lighthouse_pages
    ]

    try:
        results = await asyncio.gather(
            *tasks,
            return_exceptions=True,
        )
    except asyncio.CancelledError:
        logger.warning(f"[{job_id}] Performance audit cancelled")
        raise

    lighthouse_results = []

    for result in results:
        if isinstance(result, asyncio.CancelledError):
            raise result

        if isinstance(result, Exception):
            logger.error(
                f"[{job_id}] Unexpected page audit error: {result}"
            )
            continue

        if result:
            lighthouse_results.append(result)

    html_results = [
        _html_only_page(page, thresholds, job_id)
        for page in html_only_pages
    ]

    all_results = lighthouse_results + html_results
    all_anomalies = [
        anomaly
        for result in all_results
        for anomaly in result.get("anomalies", [])
    ]

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
        logger.info(f"[{job_id}] Lighthouse + HTML → {url}")

        try:
            lighthouse_result = await _run_lighthouse(
                url,
                strategy,
                job_id,
            )
        except asyncio.CancelledError:
            logger.warning(f"[{job_id}] Lighthouse cancelled for {url}")
            raise

        html_result = _analyze_html(html, url)
        anomalies = []

        if lighthouse_result.get("error"):
            logger.error(
                f"[{job_id}] Lighthouse failed on {url}: "
                f"{lighthouse_result['error']}"
            )

            metrics = {
                "lighthouse_score": None,
                "lcp_ms": None,
                "ttfb_ms": None,
                "cls": None,
                "lighthouse_error": lighthouse_result["error"],
            }

        elif lighthouse_result.get("score") is None:
            logger.warning(
                f"[{job_id}] Lighthouse returned incomplete data for {url}"
            )

            metrics = {
                "lighthouse_score": None,
                "lcp_ms": lighthouse_result.get("lcp_ms"),
                "ttfb_ms": lighthouse_result.get("ttfb_ms"),
                "cls": lighthouse_result.get("cls"),
                "lighthouse_error": "Incomplete Lighthouse data",
            }

        else:
            metrics = {
                "lighthouse_score": lighthouse_result["score"],
                "lcp_ms": lighthouse_result.get("lcp_ms"),
                "ttfb_ms": lighthouse_result.get("ttfb_ms"),
                "cls": lighthouse_result.get("cls"),
            }

            anomalies.extend(
                _detect_lighthouse_anomalies(
                    lighthouse_result,
                    thresholds,
                    url,
                )
            )

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
    endpoint = f"{LIGHTHOUSE_SERVICE_URL}/audit"

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(LIGHTHOUSE_TIMEOUT_SECONDS),
            trust_env=False,
        ) as client:
            response = await client.post(
                endpoint,
                json={
                    "url": url,
                    "strategy": strategy,
                },
            )

        if response.is_error:
            error_body = response.text[:300]
            logger.error(
                f"[{job_id}] Lighthouse service returned "
                f"HTTP {response.status_code}: {error_body}"
            )
            return {
                "error": (
                    f"Lighthouse service HTTP {response.status_code}: "
                    f"{error_body}"
                )
            }

        try:
            data = response.json()
        except ValueError:
            return {"error": "Lighthouse service returned invalid JSON"}

        if not isinstance(data, dict):
            return {"error": "Lighthouse service returned an invalid report"}

        if data.get("error"):
            return {"error": str(data["error"])[:300]}

        return _parse_lighthouse(data)

    except httpx.TimeoutException:
        logger.error(
            f"[{job_id}] Lighthouse service timed out for {url}"
        )
        return {
            "error": (
                f"Lighthouse service timeout after "
                f"{LIGHTHOUSE_TIMEOUT_SECONDS}s"
            )
        }

    except httpx.RequestError as exc:
        logger.error(
            f"[{job_id}] Cannot reach Lighthouse service: {exc}"
        )
        return {"error": "Cannot connect to Lighthouse service"}

    except asyncio.CancelledError:
        logger.warning(f"[{job_id}] Lighthouse request cancelled for {url}")
        raise

    except Exception as exc:
        logger.exception(
            f"[{job_id}] Unexpected Lighthouse client error: {exc}"
        )
        return {"error": "Unexpected Lighthouse client error"}


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


def _detect_lighthouse_anomalies(
    lh: dict,
    thresholds: dict,
    url: str,
) -> list:
    anomalies = []

    if (
        lh.get("ttfb_ms") is not None
        and lh["ttfb_ms"] > thresholds["ttfb_ms"]
    ):
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

    if (
        lh.get("lcp_ms") is not None
        and lh["lcp_ms"] > thresholds["lcp_ms"]
    ):
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
