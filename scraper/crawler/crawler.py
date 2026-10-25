import httpx
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

# ==============================
# CONFIG (example)
# ==============================
DEFAULT_CONFIG = {
    "max_pages": 100,
    "timeout": 10,
    "delay": 0.5,
    "max_depth": 5,
    "concurrency": 3,
    "respect_robots": True,
    "auth": {
        "enabled": False,
        "login_url": "",
        "username": "",
        "password": "",
        "username_field": "username",
        "password_field": "password",
    },
}

# ==============================
# MAIN CRAWLER
# ==============================
async def crawl(base_url: str, job_id: str, config: dict):
    config = config or DEFAULT_CONFIG
    base_url = normalize_url(base_url)
    base_domain = urlparse(base_url).netloc

    visited = set()
    queued = set([base_url])

    queue = asyncio.Queue()
    await queue.put((base_url, 0))

    pages = []
    semaphore = asyncio.Semaphore(config["concurrency"])
    pages_lock = asyncio.Lock()

    async with httpx.AsyncClient(
        timeout=config["timeout"],
        follow_redirects=True,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        }
    ) as client:
        # ── Authentication ────────────────────────────────────────────────
        auth_cfg = config.get("auth", {})
        if auth_cfg.get("enabled") and auth_cfg.get("login_url"):
            await _authenticate(client, auth_cfg, job_id)

        # robots.txt
        disallowed = []
        if config["respect_robots"]:
            disallowed = await get_disallowed(client, base_url)

        async def worker():
            while True:
                # Stop if max_pages reached
                async with pages_lock:
                    if len(pages) >= config["max_pages"]:
                        return

                try:
                    url, depth = await asyncio.wait_for(queue.get(), timeout=3)
                except asyncio.TimeoutError:
                    return

                url = normalize_url(url)

                if url in visited or depth > config["max_depth"]:
                    continue

                if is_disallowed(url, disallowed):
                    continue

                visited.add(url)

                async with semaphore:
                    try:
                        response = await client.get(url)

                        page = {
                            "url": url,
                            "status": response.status_code,
                            "depth": depth,
                            "html": None,
                            "error": None,
                        }

                        content_type = response.headers.get("content-type", "")

                        # Skip non HTML EARLY
                        if "text/html" not in content_type:
                            async with pages_lock:
                                if len(pages) < config["max_pages"]:
                                    pages.append(page)
                            continue

                        if response.status_code == 200:
                            html = response.text
                            page["html"] = html

                            # Extract links
                            if depth < config["max_depth"]:
                                links = extract_links(html, url, base_domain)

                                for link in links:
                                    link = normalize_url(link)

                                    if (
                                        link not in visited
                                        and link not in queued
                                        and is_valid_url(link)
                                    ):
                                        await queue.put((link, depth + 1))
                                        queued.add(link)

                        async with pages_lock:
                            if len(pages) < config["max_pages"]:
                                pages.append(page)

                        if config["delay"] > 0:
                            await asyncio.sleep(config["delay"])

                    except Exception as e:
                        async with pages_lock:
                            if len(pages) < config["max_pages"]:
                                pages.append({
                                    "url": url,
                                    "status": None,
                                    "depth": depth,
                                    "html": None,
                                    "error": str(e),
                                })

        workers = [
            asyncio.create_task(worker())
            for _ in range(config["concurrency"])
        ]

        await asyncio.gather(*workers)

    return pages

# ==============================
# AUTHENTICATION
# ==============================
async def _authenticate(client: httpx.AsyncClient, auth_cfg: dict, job_id: str):
    login_url      = auth_cfg.get("login_url", "")
    username       = auth_cfg.get("username", "")
    password       = auth_cfg.get("password", "")
    username_field = auth_cfg.get("username_field", "username")
    password_field = auth_cfg.get("password_field", "password")

    if not login_url or not username or not password:
        print(f"[{job_id}] Auth enabled but missing credentials — skipping")
        return

    try:
        print(f"[{job_id}] Authenticating at {login_url}")
        response = await client.post(
            login_url,
            data={
                username_field: username,
                password_field: password,
            },
        )
        cookies = dict(client.cookies)
        if cookies:
            print(f"[{job_id}] Auth successful — {len(cookies)} cookie(s) stored")
        else:
            print(f"[{job_id}] Auth warning — no cookies received, login may have failed")

    except Exception as e:
        print(f"[{job_id}] Auth error — {str(e)} — continuing without authentication")

# ==============================
# HELPERS
# ==============================

def extract_links(html: str, base_url: str, base_domain: str):
    soup = BeautifulSoup(html, "lxml")
    links = set()

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        full = urljoin(base_url, href)
        parsed = urlparse(full)

        if (
            parsed.netloc == base_domain
            and parsed.scheme in ("http", "https")
            and not parsed.fragment
        ):
            clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

            # keep pagination
            if "page=" in parsed.query:
                clean += f"?{parsed.query}"

            links.add(clean)

    return list(links)


def normalize_url(url: str):
    parsed = urlparse(url)
    path = parsed.path.rstrip("/") or "/"

    query = ""
    if "page=" in parsed.query:
        query = f"?{parsed.query}"

    return f"{parsed.scheme}://{parsed.netloc}{path}{query}"


def is_valid_url(url: str):
    invalid_ext = (
        ".jpg", ".jpeg", ".png", ".gif", ".svg",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".zip", ".rar", ".mp4", ".mp3"
    )
    return not url.lower().endswith(invalid_ext)


async def get_disallowed(client, base_url):
    try:
        robots_url = urljoin(base_url, "/robots.txt")
        resp = await client.get(robots_url)

        if resp.status_code != 200:
            return []

        disallowed = []

        for line in resp.text.splitlines():
            line = line.strip()

            if line.lower().startswith("disallow:"):
                path = line.split(":", 1)[1].strip()
                if path:
                    disallowed.append(path)

        return disallowed

    except Exception:
        return []


def is_disallowed(url: str, disallowed: list):
    path = urlparse(url).path

    for rule in disallowed:
        rule = rule.rstrip("/")

        if path == rule or path.startswith(rule + "/"):
            return True

    return False