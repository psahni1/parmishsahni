import re
from urllib.parse import urlparse

def clean_text(txt: str) -> str:
    return re.sub(r"\s+", " ", (txt or "")).strip()

def canonicalize(url: str) -> str:
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}{p.path}"
    except Exception:
        return url
