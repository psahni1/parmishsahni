import os, io, uuid, asyncio, base64
from typing import List, Optional

import numpy as np
import fitz  # PyMuPDF
import httpx
import trafilatura
from duckduckgo_search import DDGS
from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from openai import OpenAI

from utils import clean_text, canonicalize

# --------- Config (env on Render) ----------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
ENABLE_WEB = os.getenv("ENABLE_WEB", "1") == "1"  # set to 0 on Render free tier

# allow comma-separated override of allowed origins
FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS",
    "https://parmishsahni-git-main-psahni1s-projects.vercel.app,https://parmishsahni.vercel.app",
)
ALLOWED_ORIGINS = [o.strip() for o in FRONTEND_ORIGINS.split(",") if o.strip()]

client = OpenAI(api_key=OPENAI_API_KEY)

# --------- App & CORS ----------
app = FastAPI(title="AI Search Bot", version="1.0")

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
def home():
    # HEAD gets 200; GET redirects to /docs
    return Response(status_code=200) if "HEAD" else RedirectResponse(url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "You are a careful research assistant. Read supplied web extracts. "
    "Answer succinctly with citations [1],[2],... that map to the provided source list. "
    "If uncertain, say what’s uncertain. Never invent citations."
)

# --------- Simple in-memory stores ----------
SESSIONS: dict[str, list[dict]] = {}
PDF_INDEX: dict[str, dict] = {}

# --------- Models ----------
class AskRequest(BaseModel):
    query: str
    max_results: int = 6
    max_pages: int = 4
    max_chars_per_doc: int = 5000

class AskResponse(BaseModel):
    answer: str
    sources: List[str]

class ImageGenRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    n: int = 1

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str

class StreamRequest(BaseModel):
    session_id: Optional[str] = None
    message: str

class PdfAskRequest(BaseModel):
    doc_id: str
    question: str
    k: int = 6

# --------- Helpers ----------
async def fetch_url(url: str, timeout: int = 20) -> Optional[str]:
    headers = {"User-Agent": "MiniSearchAI/1.0 (+https://example.local)"}
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as s:
        try:
            r = await s.get(url)
            r.raise_for_status()
            return r.text
        except Exception:
            return None

def ddg_search(query: str, max_results: int = 6) -> List[dict]:
    """Never crash the server on network errors; return [] instead."""
    if not ENABLE_WEB:
        return []
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results, safesearch="moderate"):
                if not r or "href" not in r:
                    continue
                results.append({
                    "title": r.get("title", ""),
                    "url": canonicalize(r["href"]),
                    "snippet": r.get("body", "")
                })
        # de-dup
        seen, unique = set(), []
        for item in results:
            if item["url"] in seen:
                continue
            seen.add(item["url"]); unique.append(item)
        return unique
    except Exception as e:
        print("DuckDuckGo search failed:", repr(e))
        return []

async def gather_pages(urls: List[str], max_pages: int, max_chars_per_doc: int) -> List[dict]:
    urls = urls[:max_pages]
    htmls = await asyncio.gather(*[fetch_url(u) for u in urls])
    out = []
    for u, h in zip(urls, htmls):
        if not h:
            continue
        text = trafilatura.extract(h, url=u, include_comments=False, include_tables=False) or ""
        text = clean_text(text)[:max_chars_per_doc]
        if text:
            out.append({"url": u, "text": text})
    return out

def chunk_text(txt: str, target_tokens: int = 400, overlap_tokens: int = 50) -> list[str]:
    words = txt.split()
    if not words:
        return []
    step = max(target_tokens - overlap_tokens, 50)
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i:i+target_tokens])
        chunks.append(chunk)
        i += step
    return chunks

# ---- Embeddings helpers (RAG) ----
def embed_chunks(chunks: list[str]) -> np.ndarray:
    res = client.embeddings.create(model="text-embedding-3-small", input=chunks)
    vecs = [d.embedding for d in res.data]
    return np.array(vecs, dtype=np.float32)

def embed_query(q: str) -> np.ndarray:
    res = client.embeddings.create(model="text-embedding-3-small", input=[q])
    return np.array(res.data[0].embedding, dtype=np.float32)

def top_k_chunks(qvec: np.ndarray, mat: np.ndarray, k: int = 6) -> list[int]:
    qn = qvec / (np.linalg.norm(qvec) + 1e-8)
    mn = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-8)
    scores = (mn @ qn).tolist()
    return list(np.argsort(scores)[::-1][:k])

# --------- Routes ----------
@app.get("/health")
def health():
    return {"ok": True}

# ---- Search + citations ----
@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    hits = ddg_search(req.query, max_results=req.max_results)
    urls = [h["url"] for h in hits]
    docs = await gather_pages(urls, req.max_pages, req.max_chars_per_doc) if urls else []

    sources = [d["url"] for d in docs]
    if docs:
        bundles = []
        for i, d in enumerate(docs, start=1):
            bundles.append(f"Source [{i}] ({d['url']}):\n{d['text'][:900]}\n")
        context = "\n\n".join(bundles)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"User question:\n{req.query}\n\nWeb evidence (cite [1], [2], ...):\n{context}\n\nInstructions:\n- Concise answer with citations that map to the source order above.\n- If evidence is weak or conflicting, say so briefly."},
        ]
    else:
        messages = [
            {"role": "system", "content": "You are a helpful assistant. If you lack sources, be clear about uncertainty."},
            {"role": "user", "content": f"Question (no web results available): {req.query}"},
        ]

    # Use Chat Completions (SDK compatibility)
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.2,
    )
    answer = (resp.choices[0].message.content or "").strip()
    return AskResponse(answer=answer, sources=sources)

# ---- Image Generation ----
@app.post("/image/generate")
async def generate_image(req: ImageGenRequest):
    img = client.images.generate(
        model=OPENAI_IMAGE_MODEL,
        prompt=req.prompt,
        size=req.size,
        n=req.n
    )
    return {"data": [d.b64_json for d in img.data]}

# ---- OCR via Vision ----
@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    content = await file.read()
    b64 = "data:" + (file.content_type or "image/png") + ";base64," + base64.b64encode(content).decode()
    resp = client.chat.completions.create(
        model=OPENAI_VISION_MODEL,
        messages=[{
            "role": "system",
            "content": "Extract all visible text. Preserve line breaks if possible."
        },{
            "role": "user",
            "content": [
                {"type": "text", "text": "Please OCR the image and return text only."},
                {"type": "image_url", "image_url": {"url": b64}}
            ]
        }],
        temperature=0,
    )
    text = (resp.choices[0].message.content or "").strip()
    return {"text": text}

# ---- Chat (non-streaming, with simple history) ----
@app.post("/chat")
def chat(req: ChatRequest):
    sid = req.session_id or str(uuid.uuid4())
    history = SESSIONS.get(sid, [])
    history.append({"role":"user","content":req.message})

    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role":"system","content":"You are a helpful assistant."}] + history,
        temperature=0.2,
    )
    answer = (resp.choices[0].message.content or "").strip()
    history.append({"role":"assistant","content":answer})
    SESSIONS[sid] = history
    return {"session_id": sid, "answer": answer}

# ---- Chat (streaming via SSE) ----
@app.post("/chat/stream")
async def chat_stream(req: StreamRequest):
    sid = req.session_id or str(uuid.uuid4())
    history = SESSIONS.get(sid, [])
    history.append({"role":"user","content":req.message})

    async def event_gen():
        stream = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":"You are a helpful assistant."}] + history,
            temperature=0.2,
            stream=True,
        )
        full = []
        async for chunk in stream:
            for choice in chunk.choices:
                delta = choice.delta.content or ""
                if delta:
                    full.append(delta)
                    yield {"event":"message", "data": f'{{"event":"token","data":{json_escape(delta)}}}'}
        final = "".join(full).strip()
        history.append({"role":"assistant","content":final})
        SESSIONS[sid] = history
        yield {"event":"message", "data": f'{{"event":"done","data":"{sid}"}}'}

    return EventSourceResponse(event_gen(), media_type="text/event-stream")

def json_escape(s: str) -> str:
    return '"' + s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\r','') + '"'

# ---- PDF upload + RAG ask ----
@app.post("/pdf/upload")
async def pdf_upload(file: UploadFile = File(...)):
    data = await file.read()
    ext = (file.filename or "pdf").split(".")[-1].lower()
    doc = fitz.open(stream=data, filetype=ext)
    full_text = []
    for page in doc:
        full_text.append(page.get_text("text"))
    doc.close()
    txt = "\n".join(full_text).strip()
    if not txt:
        return {"error":"No extractable text found."}

    chunks = chunk_text(txt, 400, 50)
    embs = embed_chunks(chunks)
    doc_id = str(uuid.uuid4())
    PDF_INDEX[doc_id] = {"chunks": chunks, "embeddings": embs}
    return {"doc_id": doc_id, "chunks": len(chunks)}

@app.post("/pdf/ask")
def pdf_ask(req: PdfAskRequest):
    idx = PDF_INDEX.get(req.doc_id)
    if not idx:
        return {"error":"Unknown doc_id"}
    qvec = embed_query(req.question)
    rows = idx["embeddings"]
    top_idx = top_k_chunks(qvec, rows, k=req.k)
    context = "\n\n---\n\n".join([idx["chunks"][i] for i in top_idx])

    messages = [
        {"role":"system","content":"Answer using only the provided PDF context. If unsure, say so."},
        {"role":"user","content": f"Question: {req.question}\n\nContext:\n{context}"}
    ]
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.2,
    )
    answer = (resp.choices[0].message.content or "").strip()
    return {"answer": answer, "selected_chunks": top_idx}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "10000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
