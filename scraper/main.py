from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
import requests
from typing import Optional, Dict, Any

load_dotenv()

with open("config.json", "r") as f:
    CONFIG = json.load(f)

app = FastAPI(
    title="PixiAudit Scraper",
    description="Scraper service — Crawl, SEO, Performance, Security, PDF",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    msg = traceback.format_exc()
    print(f"[GLOBAL ERROR] {str(exc)}")
    print(msg)
    return JSONResponse(status_code=500, content={"detail": str(exc), "trace": msg})

class ScrapeRequest(BaseModel):
    job_id:          str
    url:             str
    config_override: dict = {}

class PdfRequest(BaseModel):
    job_id: str

def _deep_merge(base: dict, override: dict) -> dict:
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result

# ✅ NEW: Fetch settings from backend
def fetch_settings() -> Optional[Dict[str, Any]]:
    """
    Fetch scoring settings from backend
    Returns settings dict or None if fetch fails
    """
    try:
        backend_url = os.getenv("BACKEND_URL", "http://localhost:3001")
        response = requests.get(f"{backend_url}/settings", timeout=5)
        
        if response.status_code == 200:
            settings = response.json()
            print(f"[SCRAPER] ✅ Loaded settings from backend")
            print(f"[SCRAPER] 📋 SEO deductions: {settings.get('seoDeductions', 'N/A')}")
            print(f"[SCRAPER] 📋 Security scoring: {settings.get('securityScoring', 'N/A')}")
            return settings
        else:
            print(f"[SCRAPER] ⚠️ Failed to load settings: HTTP {response.status_code}")
            return None
            
    except requests.exceptions.Timeout:
        print(f"[SCRAPER] ⚠️ Failed to load settings: Backend timeout")
        return None
    except requests.exceptions.ConnectionError:
        print(f"[SCRAPER] ⚠️ Failed to load settings: Backend not reachable")
        return None
    except Exception as e:
        print(f"[SCRAPER] ⚠️ Failed to load settings: {e}")
        return None

@app.get("/health")
def health():
    return {"status": "ok", "service": "pixiaudit-scraper"}

@app.get("/detect-cms")
async def detect_cms(url: str):
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            res = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            html = res.text.lower()
            headers = {k.lower(): v.lower() for k, v in res.headers.items()}

        cms = None

        # WordPress
        if any(x in html for x in ["/wp-content/", "/wp-includes/", "wp-json", "wordpress"]):
            cms = "WordPress"
        # Joomla
        elif any(x in html for x in ["/components/com_", "joomla", "/media/jui/"]):
            cms = "Joomla"
        # Drupal
        elif any(x in html for x in ["drupal", "/sites/default/files/", "drupal.settings"]):
            cms = "Drupal"
        # Shopify
        elif any(x in html for x in ["shopify", "myshopify.com", "cdn.shopify"]):
            cms = "Shopify"
        # Magento
        elif any(x in html for x in ["magento", "mage/cookies", "varien"]):
            cms = "Magento"
        # PrestaShop
        elif any(x in html for x in ["prestashop", "/modules/prestashop", "id_product", "addtocart"]):
            cms = "PrestaShop"
        # Wix
        elif any(x in html for x in ["wix.com", "_wix_", "wixsite.com", "wixstatic"]):
            cms = "Wix"
        # Squarespace
        elif any(x in html for x in ["squarespace", "static.squarespace", "squarespace-cdn"]):
            cms = "Squarespace"
        # Webflow
        elif any(x in html for x in ["webflow", "wf-form", "webflow.com"]):
            cms = "Webflow"
        # Ghost
        elif any(x in html for x in ["ghost.io", "content/themes/ghost", "ghost-url"]):
            cms = "Ghost"
        # TYPO3
        elif any(x in html for x in ["typo3", "typo3temp", "typo3conf"]):
            cms = "TYPO3"
        # OpenCart
        elif any(x in html for x in ["opencart", "catalog/view/theme", "route=common"]):
            cms = "OpenCart"
        # Woocommerce (WordPress + WooCommerce)
        elif any(x in html for x in ["woocommerce", "wc-cart", "wc_add_to_cart"]):
            cms = "WooCommerce"
        # Blogger
        elif any(x in html for x in ["blogger.com", "blogspot.com", "www.blogger.com/static"]):
            cms = "Blogger"
        # HubSpot CMS
        elif any(x in html for x in ["hubspot", "hs-sites.com", "hsforms"]):
            cms = "HubSpot"
        # Notion
        elif any(x in html for x in ["notion.so", "notion.site"]):
            cms = "Notion"
        # Contentful
        elif any(x in html for x in ["contentful", "ctfassets.net"]):
            cms = "Contentful"
        # Adobe Experience Manager
        elif any(x in html for x in ["aem", "/content/dam/", "/etc/clientlibs/"]):
            cms = "Adobe AEM"
        # Sitecore
        elif any(x in html for x in ["sitecore", "/sitecore/", "sitecore.net"]):
            cms = "Sitecore" 
        # October CMS
        elif any(x in html for x in ["/storage/app/uploads/", "october", "octobercms"]):
            cms = "October CMS"       
        # Check x-powered-by header
        elif "x-powered-by" in headers:
            powered = headers["x-powered-by"]
            if "wordpress" in powered:   cms = "WordPress"
            elif "joomla" in powered:    cms = "Joomla"
            elif "drupal" in powered:    cms = "Drupal"
            elif "express" in powered:   cms = "Autre"
        # Check x-generator header
        elif "x-generator" in headers:
            gen = headers["x-generator"]
            if "wordpress" in gen:       cms = "WordPress"
            elif "drupal" in gen:        cms = "Drupal"
            elif "joomla" in gen:        cms = "Joomla"

        return { "cms": cms }

    except Exception as e:
        print(f"[detect-cms] Error: {e}")
        return { "cms": None }

@app.post("/scrape")
async def scrape(req: ScrapeRequest):
    print(f"[SCRAPER] ── START job_id={req.job_id} url={req.url}")
    
    # ✅ NEW: Fetch settings from backend ONCE at the start
    settings = fetch_settings()
    
    try:
        config = _deep_merge(CONFIG, req.config_override)

        # ── Which audits to run ───────────────────────────────────────────
        audits_cfg    = config.get("audits", {})
        run_seo       = audits_cfg.get("seo",         True)
        run_perf      = audits_cfg.get("performance",  True)
        run_security  = audits_cfg.get("security",     True)

        print(f"[SCRAPER] ── Audits enabled — seo={run_seo} perf={run_perf} security={run_security}")

        # ── Crawler ───────────────────────────────────────────────────────
        crawler_config = {
            "max_pages":      config["crawler"]["max_pages"],
            "timeout":        config["crawler"]["timeout_sec"],
            "delay":          config["crawler"]["delay_ms"] / 1000,
            "max_depth":      config["crawler"]["max_depth"],
            "concurrency":    config["crawler"].get("concurrency", 3),
            "respect_robots": config["crawler"]["respect_robots_txt"],
            "auth":           config["crawler"].get("auth", {"enabled": False}),
        }
        print(f"[SCRAPER] ── Config OK: {crawler_config}")

        from crawler.crawler import crawl
        print(f"[SCRAPER] ── Crawl started")
        pages = await crawl(req.url, req.job_id, crawler_config)
        print(f"[SCRAPER] ── Crawl done — {len(pages)} pages")

        # ── SEO ───────────────────────────────────────────────────────────
        seo_result = {"results": [], "score": None}
        if run_seo:
            from audits.audit_seo import run_seo_audit
            print(f"[SCRAPER] ── SEO audit started")
            # ✅ Pass settings to audit function
            seo_result = await run_seo_audit(pages, req.job_id, config, settings)
            print(f"[SCRAPER] ── SEO audit done — score={seo_result.get('score')}")
        else:
            print(f"[SCRAPER] ── SEO audit skipped")

        # ── Performance ───────────────────────────────────────────────────
        perf_result = {"pages": [], "global_score": None}
        if run_perf:
            from audits.audit_performance import run_performance_audit
            print(f"[SCRAPER] ── Performance audit started")
            perf_result = await run_performance_audit(pages, req.job_id, config)
            print(f"[SCRAPER] ── Performance audit done — score={perf_result.get('global_score')}")
        else:
            print(f"[SCRAPER] ── Performance audit skipped")

        # ── Security ──────────────────────────────────────────────────────
        sec_result = {"score": None}
        if run_security:
            from audits.audit_security import run_security_audit
            print(f"[SCRAPER] ── Security audit started")
            # ✅ Pass settings to audit function
            sec_result = await run_security_audit(req.url, req.job_id, config, settings)
            print(f"[SCRAPER] ── Security audit done — score={sec_result.get('score')}")
        else:
            print(f"[SCRAPER] ── Security audit skipped")

        print(f"[SCRAPER] ✅ job_id={req.job_id} — all audits done")

        # ── Merge SEO + Performance per URL ──────────────────────────────
        pages_dict = {}

        for seo_page in seo_result.get("results", []):
            url = seo_page["url"]
            pages_dict[url] = {
                "seo": {
                    "h1_count":      seo_page["h1_count"],
                    "has_canonical": seo_page["has_canonical"],
                    "anomalies":     seo_page["anomalies"],
                }
            }

        for perf_page in perf_result["pages"]:
            url = perf_page["url"]
            perf_data = {
                "metrics":   perf_page.get("metrics", {}),
                "causes":    perf_page.get("causes", {}),
                "anomalies": perf_page.get("anomalies", []),
            }
            if url in pages_dict:
                pages_dict[url]["performance"] = perf_data
            else:
                pages_dict[url] = {"performance": perf_data}

        # ✅ REAL SCORES (not mock!)
        seo_score = seo_result.get("score") if run_seo else None
        perf_score = perf_result.get("global_score") if run_perf else None
        sec_score = sec_result.get("score") if run_security else None

        print(f"[SCRAPER] 📊 Real scores — SEO={seo_score} PERF={perf_score} SEC={sec_score}")

        return {
            "job_id":            req.job_id,
            "status":            "done",
            "pages_crawled":     len(pages),
            "seo_score":         seo_score,        # ✅ REAL
            "performance_score": perf_score,       # ✅ REAL
            "security_score":    sec_score,        # ✅ REAL
            "pages":             pages_dict,
            "security":          sec_result,
        }

    except Exception as e:
        import traceback
        print(f"[SCRAPER] ❌ {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-pdf")
async def generate_pdf(req: PdfRequest):
    print(f"[SCRAPER] PDF generation — job_id={req.job_id}")
    try:
        from pdf.generator import generate
        file_path = await generate(req.job_id)
        return {"job_id": req.job_id, "file_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8002)),
        reload=False,
    )