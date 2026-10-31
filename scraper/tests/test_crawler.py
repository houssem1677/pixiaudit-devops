import pytest
import crawler.crawler as crawler_module

from crawler.crawler import (
    extract_links,
    normalize_url,
    is_valid_url,
    is_disallowed,
)


@pytest.mark.asyncio
async def test_crawl_discovers_internal_links(monkeypatch):
    requested_urls = []

    class LinkFakeAsyncClient(FakeAsyncClient):
        async def get(self, url):
            requested_urls.append(url)

            if url == "https://example.com/":
                html = '<html><a href="/about">About</a></html>'
            else:
                html = "<html><h1>About</h1></html>"

            return FakeResponse(text=html)

    monkeypatch.setattr(
        crawler_module.httpx,
        "AsyncClient",
        LinkFakeAsyncClient,
    )

    config = {
        "max_pages": 10,
        "timeout": 5,
        "delay": 0,
        "max_depth": 2,
        "concurrency": 1,
        "respect_robots": False,
        "auth": {"enabled": False},
    }

    pages = await crawler_module.crawl(
        "https://example.com",
        "test-job",
        config,
    )

    assert len(pages) == 2
    assert "https://example.com/" in requested_urls
    assert "https://example.com/about" in requested_urls

@pytest.mark.asyncio
async def test_crawl_respects_max_pages(monkeypatch):
    class ManyLinksFakeClient(FakeAsyncClient):
        async def get(self, url):
            html = """
            <html>
                <a href="/page1">Page 1</a>
                <a href="/page2">Page 2</a>
                <a href="/page3">Page 3</a>
            </html>
            """
            return FakeResponse(text=html)

    monkeypatch.setattr(
        crawler_module.httpx,
        "AsyncClient",
        ManyLinksFakeClient,
    )

    config = {
        "max_pages": 2,
        "timeout": 5,
        "delay": 0,
        "max_depth": 3,
        "concurrency": 1,
        "respect_robots": False,
        "auth": {"enabled": False},
    }

    pages = await crawler_module.crawl(
        "https://example.com",
        "test-job",
        config,
    )

    assert len(pages) == 2

@pytest.mark.asyncio
async def test_crawl_respects_max_depth(monkeypatch):
    requested_urls = []

    class DepthFakeClient(FakeAsyncClient):
        async def get(self, url):
            requested_urls.append(url)

            if url == "https://example.com/":
                html = '<a href="/level1">Level 1</a>'
            elif url == "https://example.com/level1":
                html = '<a href="/level2">Level 2</a>'
            else:
                html = "<html><body>Level 2</body></html>"

            return FakeResponse(text=html)

    monkeypatch.setattr(
        crawler_module.httpx,
        "AsyncClient",
        DepthFakeClient,
    )

    config = {
        "max_pages": 10,
        "timeout": 5,
        "delay": 0,
        "max_depth": 1,
        "concurrency": 1,
        "respect_robots": False,
        "auth": {"enabled": False},
    }

    pages = await crawler_module.crawl(
        "https://example.com",
        "test-job",
        config,
    )

    assert "https://example.com/" in requested_urls
    assert "https://example.com/level1" in requested_urls
    assert "https://example.com/level2" not in requested_urls
    assert len(pages) == 2

@pytest.mark.asyncio
async def test_crawl_records_non_html_response(monkeypatch):
    class NonHtmlFakeClient(FakeAsyncClient):
        async def get(self, url):
            return FakeResponse(
                status_code=200,
                text="PDF content",
                content_type="application/pdf",
            )

    monkeypatch.setattr(
        crawler_module.httpx,
        "AsyncClient",
        NonHtmlFakeClient,
    )

    config = {
        "max_pages": 10,
        "timeout": 5,
        "delay": 0,
        "max_depth": 2,
        "concurrency": 1,
        "respect_robots": False,
        "auth": {"enabled": False},
    }

    pages = await crawler_module.crawl(
        "https://example.com",
        "test-job",
        config,
    )

    assert len(pages) == 1
    assert pages[0]["status"] == 200
    assert pages[0]["html"] is None
    assert pages[0]["error"] is None

class FakeResponse:
    def __init__(self, status_code=200, text="", content_type="text/html"):
        self.status_code = status_code
        self.text = text
        self.headers = {"content-type": content_type}


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        self.requested_urls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def get(self, url):
        self.requested_urls.append(url)

        return FakeResponse(
            status_code=200,
            text="<html><body><h1>Home</h1></body></html>",
        )


@pytest.mark.asyncio
async def test_crawl_fetches_starting_page(monkeypatch):
    monkeypatch.setattr(
        crawler_module.httpx,
        "AsyncClient",
        FakeAsyncClient,
    )

    async def fake_get_disallowed(client, base_url):
        return []

    monkeypatch.setattr(
        crawler_module,
        "get_disallowed",
        fake_get_disallowed,
    )

    config = {
        "max_pages": 10,
        "timeout": 5,
        "delay": 0,
        "max_depth": 2,
        "concurrency": 1,
        "respect_robots": False,
        "auth": {"enabled": False},
    }

    pages = await crawler_module.crawl(
        "https://example.com",
        "test-job",
        config,
    )

    assert len(pages) == 1
    assert pages[0]["url"] == "https://example.com/"
    assert pages[0]["status"] == 200
    assert pages[0]["depth"] == 0
    assert pages[0]["html"] is not None
    assert pages[0]["error"] is None

# -------------------------
# URL normalization
# -------------------------

def test_normalize_url_removes_trailing_slash():
    assert normalize_url("https://example.com/about/") == (
        "https://example.com/about"
    )


def test_normalize_url_removes_fragment():
    assert normalize_url("https://example.com/about#team") == (
        "https://example.com/about"
    )


def test_normalize_url_preserves_page_parameter():
    result = normalize_url("https://example.com/blog?page=2")
    assert "page=2" in result


# -------------------------
# Link extraction
# -------------------------

def test_extract_links_finds_internal_links():
    html = """
    <html>
        <body>
            <a href="/about">About</a>
            <a href="https://example.com/contact">Contact</a>
        </body>
    </html>
    """

    links = extract_links(
        html,
        "https://example.com",
        "example.com",
    )

    assert any("/about" in link for link in links)
    assert any("/contact" in link for link in links)


def test_extract_links_ignores_external_links():
    html = """
    <html>
        <body>
            <a href="https://example.com/about">Internal</a>
            <a href="https://other-site.com/page">External</a>
        </body>
    </html>
    """

    links = extract_links(
        html,
        "https://example.com",
        "example.com",
    )

    assert any("example.com/about" in link for link in links)
    assert not any("other-site.com" in link for link in links)


def test_extract_links_ignores_non_http_links():
    html = """
    <a href="mailto:test@example.com">Email</a>
    <a href="javascript:void(0)">JavaScript</a>
    <a href="tel:+123456789">Phone</a>
    """

    links = extract_links(
        html,
        "https://example.com",
        "example.com",
    )

    assert len(links) == 0


# -------------------------
# Resource filtering
# -------------------------

@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/image.jpg",
        "https://example.com/document.pdf",
        "https://example.com/archive.zip",
    ],
)
def test_is_valid_url_rejects_non_html_resources(url):
    assert is_valid_url(url) is False


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/",
        "https://example.com/about",
        "https://example.com/blog?page=2",
    ],
)
def test_is_valid_url_accepts_web_pages(url):
    assert is_valid_url(url) is True


# -------------------------
# robots.txt rules
# -------------------------

def test_is_disallowed_matches_exact_path():
    assert is_disallowed(
        "https://example.com/private",
        ["/private"],
    ) is True


def test_is_disallowed_matches_path_prefix():
    assert is_disallowed(
        "https://example.com/private/account",
        ["/private"],
    ) is True


def test_is_disallowed_allows_unrelated_path():
    assert is_disallowed(
        "https://example.com/public",
        ["/private"],
    ) is False
