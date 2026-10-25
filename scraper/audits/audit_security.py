import ssl
import socket
import httpx
from datetime import datetime
from utils.logger import get_logger
from urllib.parse import urlparse
import requests
from typing import Dict, Any, Optional

logger = get_logger("audit_security")

def calculate_security_score(
    ssl_result: Dict[str, Any],
    headers_result: Dict[str, Any],
    settings: Optional[Dict[str, Any]] = None
) -> int:
    """
    Calculate security score using configurable scoring parameters
    
    Args:
        ssl_result: SSL check result
        headers_result: Security headers check result
        settings: Settings from backend (optional)
    
    Returns:
        Score as integer (0-100)
    """
    
    # ✅ Use dynamic scoring from settings, or fall back to defaults
    if settings and "securityScoring" in settings:
        scoring = settings["securityScoring"]
        logger.info(f"Using dynamic security scoring from settings")
    else:
        # Default scoring (fallback)
        scoring = {
            "sslValid": 50,
            "sslExpiringSoon": -5,
            "headerPresent": 10,
            "headerMissing": -10,
        }
        logger.info(f"Using default security scoring")
    
    score = 0
    
    # SSL Certificate scoring
    if ssl_result.get("ssl_valid"):
        score += scoring["sslValid"]
        logger.info(f"SSL valid: +{scoring['sslValid']} points")
        
        # Check if expiring soon (< 30 days)
        days_remaining = ssl_result.get("ssl_days_remaining", 999)
        if days_remaining < 30:
            score += scoring["sslExpiringSoon"]  # Negative value
            logger.info(f"SSL expiring soon ({days_remaining} days): {scoring['sslExpiringSoon']} points")
    else:
        logger.info(f"SSL invalid: 0 points")
    
    # Security Headers scoring
    present_headers = headers_result.get("present_headers", [])
    missing_headers = headers_result.get("missing_headers", [])
    
    present_points = len(present_headers) * scoring["headerPresent"]
    missing_points = len(missing_headers) * scoring["headerMissing"]  # Negative value
    
    score += present_points
    score += missing_points
    
    logger.info(
        f"Headers: {len(present_headers)} present (+{present_points}), "
        f"{len(missing_headers)} missing ({missing_points})"
    )
    
    # Clamp score between 0-100
    final_score = max(0, min(100, score))
    final_score = round(final_score)
    
    logger.info(f"Security final score: {final_score}/100")
    
    return final_score


async def run_security_audit(
    url: str, 
    job_id: str, 
    config: dict,
    settings: Optional[Dict[str, Any]] = None  # ✅ NEW PARAMETER
) -> dict:
    """
    Run security audit on target URL
    
    Args:
        url: Target URL to audit
        job_id: Audit job ID
        config: Configuration dict
        settings: Settings from backend (optional)
    
    Returns: 
        dict with ssl, headers, and score
    """
    sec_cfg          = config["security"]
    check_ssl        = sec_cfg.get("check_ssl",      True)
    check_headers    = sec_cfg.get("check_headers",  True)
    required_headers = sec_cfg.get("required_headers", [])
    days_warning     = sec_cfg.get("ssl_days_warning", 30)

    parsed   = urlparse(url)
    hostname = parsed.netloc.replace("www.", "")

    logger.info(
        f"[{job_id}] Security audit — {hostname} — "
        f"check_ssl={check_ssl} check_headers={check_headers} "
        f"headers={required_headers}"
    )

    # ── SSL ───────────────────────────────────────────────────────────────
    ssl_result    = {}
    ssl_anomalies = []

    if check_ssl:
        ssl_result = _check_ssl(hostname, job_id, days_warning)

        if not ssl_result["ssl_valid"]:
            ssl_anomalies.append({
                "type":   "SSL_INVALID",
                "detail": ssl_result.get("ssl_error", "Invalid SSL certificate")
            })
        elif ssl_result.get("ssl_days_remaining") is not None:
            if ssl_result["ssl_days_remaining"] < days_warning:
                ssl_anomalies.append({
                    "type":   "SSL_EXPIRING_SOON",
                    "detail": (
                        f"Certificate expires in {ssl_result['ssl_days_remaining']} days "
                        f"— renew before {days_warning}-day threshold"
                    )
                })
    else:
        logger.info(f"[{job_id}] SSL check skipped")

    # ── HTTP Headers ──────────────────────────────────────────────────────
    headers_result  = {}
    header_anomalies = []

    if check_headers and required_headers:
        headers_result = await _check_headers(url, job_id, required_headers)

        header_descriptions = {
            "Strict-Transport-Security": "vulnerable to downgrade attacks",
            "Content-Security-Policy":   "vulnerable to XSS attacks",
            "X-Frame-Options":           "vulnerable to clickjacking",
            "X-Content-Type-Options":    "vulnerable to MIME sniffing",
        }

        for header in headers_result.get("missing_headers", []):
            desc = header_descriptions.get(header, "security risk")
            header_anomalies.append({
                "type":   "MISSING_HEADER",
                "detail": f"{header} missing — {desc}"
            })
    else:
        logger.info(f"[{job_id}] Header check skipped")

    # ✅ Calculate score with settings
    score = calculate_security_score(ssl_result, headers_result, settings)

    logger.info(
        f"[{job_id}] Security done — "
        f"ssl_valid={ssl_result.get('ssl_valid', 'skipped')} — "
        f"anomalies={len(ssl_anomalies) + len(header_anomalies)} — "
        f"score={score}"
    )

    return {
        "job_id": job_id,
        "score": score,  # ✅ Score from dynamic settings
        "ssl": {
            "ssl_valid":          ssl_result.get("ssl_valid"),
            "ssl_expiry":         ssl_result.get("ssl_expiry"),
            "ssl_issuer":         ssl_result.get("ssl_issuer"),
            "ssl_days_remaining": ssl_result.get("ssl_days_remaining"),
            "anomalies":          ssl_anomalies,
        } if check_ssl else {"skipped": True, "anomalies": []},

        "headers": {
            "present":   headers_result.get("present_headers", []),
            "missing":   headers_result.get("missing_headers", []),
            "anomalies": header_anomalies,
        } if check_headers else {"skipped": True, "anomalies": []},
    }


def _check_ssl(hostname: str, job_id: str, days_warning: int) -> dict:
    try:
        context = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()

        expiry_str = cert.get("notAfter", "")
        expiry     = datetime.strptime(expiry_str, "%b %d %H:%M:%S %Y %Z")
        days_left  = (expiry - datetime.utcnow()).days

        issuer_parts = dict(x[0] for x in cert.get("issuer", []))
        issuer = issuer_parts.get("organizationName", "Unknown")

        logger.info(f"[{job_id}] SSL valid — expires in {days_left} days — issuer: {issuer}")

        return {
            "ssl_valid":          True,
            "ssl_expiry":         expiry.strftime("%d %b %Y"),
            "ssl_issuer":         issuer,
            "ssl_days_remaining": days_left,
        }

    except Exception as e:
        logger.error(f"[{job_id}] SSL error: {str(e)}")
        return {"ssl_valid": False, "ssl_error": str(e)}


async def _check_headers(url: str, job_id: str, required_headers: list) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp    = await client.get(url)
            headers = {k.lower(): v for k, v in resp.headers.items()}

        present = []
        missing = []

        for h in required_headers:
            if h.lower() in headers:
                present.append(h)
            else:
                missing.append(h)

        logger.info(f"[{job_id}] Headers — {len(present)} present, {len(missing)} missing")

        return {
            "present_headers": present,
            "missing_headers": missing,
            "https":           url.startswith("https"),
        }

    except Exception as e:
        logger.error(f"[{job_id}] Headers error: {str(e)}")
        return {
            "present_headers": [],
            "missing_headers": required_headers,
            "https":           False,
            "error":           str(e),
        }