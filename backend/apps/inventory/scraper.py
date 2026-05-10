"""
Product URL scraper for inventory import.
Extracts product data from any product page using:
  1. JSON-LD structured data (most reliable)
  2. OpenGraph meta tags
  3. HTML fallback (title, first image, etc.)
"""
import json
import re
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

logger = logging.getLogger("apps")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


def scrape_product(url: str) -> dict:
    """
    Fetch and parse a product URL.
    Returns a dict with keys: name, description, image_url, price, supplier, source_url, extra
    Raises ValueError on fetch failure or if page looks non-product.
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        raise ValueError("الصفحة استغرقت وقتاً طويلاً - حاول مرة أخرى")
    except requests.exceptions.ConnectionError:
        raise ValueError("تعذّر الاتصال بالرابط - تأكد من صحة الرابط")
    except requests.exceptions.HTTPError as e:
        raise ValueError(f"خطأ في الصفحة: {e.response.status_code}")

    soup = BeautifulSoup(resp.text, "lxml")
    domain = urlparse(url).netloc.replace("www.", "")

    result = {
        "name": "",
        "description": "",
        "image_url": "",
        "price": None,
        "supplier": domain,
        "source_url": url,
        "extra": {},
    }

    # ── 1. JSON-LD structured data ────────────────────────────────────────────
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                data = next((d for d in data if d.get("@type") in ("Product", "ItemPage")), data[0] if data else {})
            if isinstance(data, dict) and data.get("@type") in ("Product", "ItemPage", "WebPage"):
                result["name"] = result["name"] or _clean(data.get("name", ""))
                result["description"] = result["description"] or _clean(data.get("description", ""))

                img = data.get("image")
                if isinstance(img, list):
                    img = img[0]
                if isinstance(img, dict):
                    img = img.get("url", "")
                result["image_url"] = result["image_url"] or (img or "")

                offers = data.get("offers") or data.get("Offers")
                if isinstance(offers, list):
                    offers = offers[0]
                if isinstance(offers, dict):
                    price_raw = offers.get("price") or offers.get("lowPrice")
                    try:
                        result["price"] = float(str(price_raw).replace(",", ""))
                    except (TypeError, ValueError):
                        pass
                    result["extra"]["currency"] = offers.get("priceCurrency", "")

                for prop in data.get("additionalProperty", []):
                    if isinstance(prop, dict):
                        k = prop.get("name", "")
                        v = prop.get("value", "")
                        if k and v:
                            result["extra"][k] = v
        except (json.JSONDecodeError, AttributeError):
            continue

    # ── 2. OpenGraph tags ────────────────────────────────────────────────────
    og = {}
    for tag in soup.find_all("meta"):
        prop = tag.get("property", "") or tag.get("name", "")
        content = tag.get("content", "")
        if prop.startswith("og:") or prop.startswith("product:"):
            og[prop] = content

    result["name"] = result["name"] or _clean(og.get("og:title", ""))
    result["description"] = result["description"] or _clean(og.get("og:description", ""))
    result["image_url"] = result["image_url"] or og.get("og:image", "")

    if not result["price"]:
        for key in ("product:price:amount", "og:price:amount", "product:price"):
            if og.get(key):
                try:
                    result["price"] = float(og[key].replace(",", ""))
                    result["extra"]["currency"] = og.get("product:price:currency", og.get("og:price:currency", ""))
                    break
                except ValueError:
                    pass

    # ── 3. HTML fallback ──────────────────────────────────────────────────────
    if not result["name"]:
        h1 = soup.find("h1")
        result["name"] = _clean(h1.get_text()) if h1 else _clean(soup.title.string if soup.title else "")

    if not result["description"]:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            result["description"] = _clean(meta_desc.get("content", ""))

    if not result["image_url"]:
        for img in soup.find_all("img", src=True):
            src = img["src"]
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                src = f"https://{domain}{src}"
            if src.startswith("http") and not any(x in src for x in ("logo", "icon", "sprite", "pixel")):
                result["image_url"] = src
                break

    # ── 4. Site-specific extractors ──────────────────────────────────────────
    if "eprintp.com" in domain:
        result = _enrich_eprintp(soup, result)

    if result["description"] and len(result["description"]) > 500:
        result["description"] = result["description"][:500].rsplit(" ", 1)[0] + "…"

    if not result["name"]:
        raise ValueError("تعذّر استخراج بيانات المنتج من هذه الصفحة")

    return result


def _enrich_eprintp(soup: BeautifulSoup, result: dict) -> dict:
    """Extra parsing for eprintp.com product pages."""
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cols = row.find_all(["td", "th"])
            if len(cols) == 2:
                key = _clean(cols[0].get_text())
                val = _clean(cols[1].get_text())
                if key and val:
                    result["extra"][key] = val

    for div in soup.find_all(class_=re.compile(r"product.?desc|spec|detail", re.I)):
        text = div.get_text(separator=" ", strip=True)
        if text and not result["description"]:
            result["description"] = text[:500]

    return result


def _clean(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()
