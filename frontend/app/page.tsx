"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "https://parmishsahni.onrender.com";

type TabKey = "search" | "image" | "ocr" | "chat" | "pdf";

export default function Page() {
  const [tab, setTab] = useState<TabKey>("search");

  return (
    <div className="flex flex-col items-center text-center gap-10">
      {/* Apple-style hero */}
      <section className="max-w-3xl space-y-4">
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight">
          Ask anything.<br className="hidden sm:block" /> Get beautiful answers.
        </h1>
        <p className="text-lg text-black/60 dark:text-white/70">
          Fast • Accurate • Cited • Vision OCR • Images • PDF Q&A
        </p>
      </section>

      {/* Tabs */}
      <div className="tabs">
        {(["search","image","ocr","chat","pdf"] as TabKey[]).map((k) => (
          <button
            key={k}
            className={`tab ${tab === k ? "tab-active" : "tab-inactive"}`}
            onClick={() => setTab(k)}
          >
            {k === "search" && "Search"}
            {k === "image"  && "Image"}
            {k === "ocr"    && "OCR"}
            {k === "chat"   && "Chat"}
            {k === "pdf"    && "PDF Q&A"}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="w-full max-w-3xl">
        {tab === "search" && <SearchPane />}
        {tab === "image"  && <ImagePane />}
        {tab === "ocr"    && <OCRPane />}
        {tab === "chat"   && <ChatPane />}
        {tab === "pdf"    && <PDFPane />}
      </div>
    </div>
  );
}

/* -------------------- Search -------------------- */
function SearchPane() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const ask = async () => {
    setLoading(true); setErr(""); setAnswer(""); setSources([]);
    try {
      const resp = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, max_results: 6, max_pages: 4, max_chars_per_doc: 4000 }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      setAnswer(data.answer || "(no answer)");
      setSources(data.sources || []);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="space-y-2 text-left">
        <label className="label">Ask anything</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="input flex-1"
            placeholder="What changed in HTTP/3 vs HTTP/2?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn self-start" onClick={ask} disabled={loading || !q.trim()}>
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600 dark:text-red-400 text-left">Error: {err}</div>}

      {answer && (
        <div className="space-y-3 text-left">
          <div className="area">{answer}</div>
          {sources.length > 0 && (
            <div className="text-sm space-y-1">
              <div className="font-medium">Sources</div>
              <ul className="list-disc pl-5">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a className="underline" href={s} target="_blank" rel="noreferrer">
                      [{i + 1}] {s}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------- Image -------------------- */
function ImagePane() {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const gen = async () => {
    setLoading(true); setImages([]);
    try {
      const resp = await fetch(`${API}/image/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024", n: 1 }),
      });
      const data = await resp.json();
      const imgs = (data.data || []).map((b64: string) => `data:image/png;base64,${b64}`);
      setImages(imgs);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-3">
      <div className="text-left space-y-2">
        <label className="label">Image prompt</label>
        <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)}
               placeholder="A pastel, neon-lit desk with plants and a MacBook" />
      </div>
      <div className="flex gap-3">
        <button className="btn" onClick={gen} disabled={loading || !prompt.trim()}>
          {loading ? "Generating…" : "Generate"}
        </button>
        <button className="btn-ghost" onClick={() => setImages([])}>Clear</button>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((src, i) => (
            <img key={i} src={src} alt={`gen-${i}`} className="rounded-2xl border border-black/10 dark:border-white/10 shadow-soft" />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- OCR -------------------- */
function OCRPane() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const ocr = async () => {
    if (!file) return;
    setLoading(true); setText("");
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(`${API}/ocr`, { method: "POST", body: fd });
    const data = await resp.json();
    setText(data.text || "(no text)");
    setLoading(false);
  };

  return (
    <div className="card p-6 space-y-3">
      <div className="text-left space-y-2">
        <label className="label">Upload an image (JPG/PNG)</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <button className="btn" onClick={ocr} disabled={loading || !file}>
        {loading ? "Reading…" : "Run OCR"}
      </button>
      {text && <pre className="area">{text}</pre>}
    </div>
  );
}

/* -------------------- Chat -------------------- */
function ChatPane() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState<string>("Say hi 👋");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setTranscript((prev) => prev + `\n\nYou: ${message}\nAssistant: `);
    const resp = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
    const data = await resp.json();
    setSessionId(data.session_id);
    setTranscript((prev) => prev + (data.answer || ""));
    setMessage("");
    setLoading(false);
  };

  return (
    <div className="card p-6 space-y-3">
      <div className="text-left text-xs text-black/60 dark:text-white/60">
        Session: <span className="rounded-full px-2 py-1 bg-white/60 dark:bg-white/10 border border-black/10 dark:border-white/10">{sessionId || "new"}</span>
      </div>
      <div className="flex gap-3">
        <input className="input flex-1" placeholder="Ask anything…" value={message}
               onChange={(e) => setMessage(e.target.value)} />
        <button className="btn" onClick={send} disabled={loading || !message.trim()}>
          {loading ? "Thinking…" : "Send"}
        </button>
      </div>
      <div className="area min-h-[160px] text-left">{transcript}</div>
    </div>
  );
}

/* -------------------- PDF Q&A -------------------- */
function PDFPane() {
  const [docId, setDocId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");

  const upload = async () => {
    if (!file) return;
    setStatus("Uploading & indexing…"); setAns("");
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(`${API}/pdf/upload`, { method: "POST", body: fd });
    const data = await resp.json();
    if (data.doc_id) {
      setDocId(data.doc_id);
      setStatus(`Indexed ${data.chunks} chunks. Ready.`);
    } else {
      setStatus(data.error || "Failed.");
    }
  };

  const ask = async () => {
    setAns("Thinking…");
    const resp = await fetch(`${API}/pdf/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_id: docId, question: q, k: 6 }),
    });
    const data = await resp.json();
    setAns(data.answer || data.error || "(no answer)");
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="text-left space-y-2">
        <div className="label">1) Upload a PDF → 2) Ask about its content</div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn self-start" onClick={upload} disabled={!file}>Upload & Index</button>
        </div>
      </div>

      {status && <div className="text-xs text-black/60 dark:text-white/60 text-left">{status}</div>}
      {docId && (<div className="text-xs text-left">doc_id: <span className="rounded-full px-2 py-1 bg-white/60 dark:bg-white/10 border border-black/10 dark:border-white/10">{docId}</span></div>)}

      <div className="flex gap-3">
        <input className="input flex-1" placeholder="Your question about the PDF…" value={q}
               onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={ask} disabled={!docId || !q.trim()}>Ask</button>
      </div>

      {ans && <div className="area text-left">{ans}</div>}
    </div>
  );
}
