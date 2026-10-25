from bs4 import BeautifulSoup
from utils.logger import get_logger
import requests
from typing import Dict, Any, Optional
logger = get_logger("audit_seo")

def calculate_seo_score(results: list, settings: Optional[Dict[str, Any]] = None) -> int:
    """
    Calculate SEO score from audit results using configurable deductions
    
    Args:
        results: List of page audit results
        settings: Settings from backend (optional, will fetch if not provided)
    
    Returns:
        Score as integer (0-100)
    """
    if not results:
        return 0
    
    # ✅ Use dynamic deductions from settings, or fall back to defaults
    if settings and "seoDeductions" in settings:
        deductions = settings["seoDeductions"]
        logger.info(f"Using dynamic SEO deductions from settings")
    else:
        # Default deductions (fallback)
        deductions = {
            "H1_MISSING": 15,
            "META_MISSING": 12,
            "TITLE_MISSING": 12,
            "TITLE_TOO_SHORT": 5,
            "TITLE_TOO_LONG": 3,
            "META_TOO_SHORT": 5,
            "META_TOO_LONG": 3,
            "H1_MULTIPLE": 5,
        }
        logger.info(f"Using default SEO deductions")
    
    # Calculate total deduction
    total_deduction = 0
    for page in results:
        for anomaly in page.get("anomalies", []):
            anomaly_type = anomaly.get("type", "")
            deduction = deductions.get(anomaly_type, 0)
            total_deduction += deduction
    
    # Average deduction per page
    avg_deduction = total_deduction / len(results) if results else 0
    
    # Calculate final score (100 - average deduction)
    final_score = max(0, min(100, 100 - avg_deduction))
    final_score = round(final_score)
    
    logger.info(
        f"SEO Score: {len(results)} pages, "
        f"{total_deduction} total deduction, "
        f"{avg_deduction:.1f} avg → score={final_score}"
    )
    
    return final_score


async def run_seo_audit(
    pages: list, 
    job_id: str, 
    config: dict, 
    settings: Optional[Dict[str, Any]] = None  # ✅ NEW PARAMETER
) -> dict:
    """
    Run SEO audit on crawled pages
    
    Args:
        pages: List of crawled pages
        job_id: Audit job ID
        config: Configuration dict
        settings: Settings from backend (optional)
    
    Returns: 
        dict with 'results' (list) and 'score' (int)
    """
    seo_cfg   = config["seo"]
    rules     = seo_cfg.get("rules", {})

    # ── Which checks are enabled ──────────────────────────────────────────
    check_h1        = rules.get("check_h1",               True)
    check_meta      = rules.get("check_meta_description",  True)
    check_title     = rules.get("check_title_length",      True)
    check_canonical = rules.get("check_canonical",         True)

    # ── Thresholds (only used if the matching check is enabled) ───────────
    title_min = seo_cfg.get("title_min_length",     50)
    title_max = seo_cfg.get("title_max_length",     60)
    meta_min  = seo_cfg.get("meta_desc_min_length", 150)
    meta_max  = seo_cfg.get("meta_desc_max_length", 160)

    logger.info(
        f"[{job_id}] SEO rules — h1={check_h1} meta={check_meta} "
        f"title={check_title} canonical={check_canonical}"
    )

    results = []

    for page in pages:
        if not page.get("html"):
            continue

        page["http_status"] = page.get("http_status") or page.get("status")
        url       = page["url"]
        soup      = BeautifulSoup(page["html"], "lxml")
        anomalies = []

        # ── H1 ────────────────────────────────────────────────────────────
        h1_tags = soup.find_all("h1")
        if check_h1:
            if len(h1_tags) == 0:
                anomalies.append({
                    "type":   "H1_MISSING",
                    "detail": "No H1 tag found on this page"
                })
            elif len(h1_tags) > 1:
                anomalies.append({
                    "type":   "H1_MULTIPLE",
                    "detail": f"{len(h1_tags)} H1 tags found — only one is allowed"
                })

        # ── Meta description ───────────────────────────────────────────────
        meta = soup.find("meta", attrs={"name": "description"})
        if check_meta:
            if meta and meta.get("content"):
                length = len(meta["content"].strip())
                if length < meta_min:
                    anomalies.append({
                        "type":   "META_TOO_SHORT",
                        "detail": f"{length} chars (min: {meta_min})"
                    })
                elif length > meta_max:
                    anomalies.append({
                        "type":   "META_TOO_LONG",
                        "detail": f"{length} chars (max: {meta_max})"
                    })
            else:
                anomalies.append({
                    "type":   "META_MISSING",
                    "detail": "No meta description found"
                })

        # ── Title ──────────────────────────────────────────────────────────
        title_tag = soup.find("title")
        if check_title:
            if title_tag and title_tag.text.strip():
                length = len(title_tag.text.strip())
                if length < title_min:
                    anomalies.append({
                        "type":   "TITLE_TOO_SHORT",
                        "detail": f"{length} chars (min: {title_min})"
                    })
                elif length > title_max:
                    anomalies.append({
                        "type":   "TITLE_TOO_LONG",
                        "detail": f"{length} chars (max: {title_max})"
                    })
            else:
                anomalies.append({
                    "type":   "TITLE_MISSING",
                    "detail": "No title tag found"
                })

        # ── Canonical ──────────────────────────────────────────────────────
        canonical = soup.find("link", attrs={"rel": "canonical"})

        results.append({
            "url":           url,
            "h1_count":      len(h1_tags),
            "has_canonical": canonical is not None,
            "anomalies":     anomalies,
        })

        logger.info(
            f"[{job_id}] {url} — "
            f"{len(anomalies)} anomaly(ies): "
            f"{[a['type'] for a in anomalies] or '✅ OK'}"
        )

    # ✅ Calculate score with settings
    score = calculate_seo_score(results, settings)
    
    logger.info(f"[{job_id}] SEO done — {len(results)} pages analysed — score={score}")
    
    return {
        "results": results,
        "score": score
    }