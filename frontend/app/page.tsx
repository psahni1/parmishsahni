'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

type TabKey = 'search' | 'image' | 'ocr' | 'chat' | 'pdf';

export default function Home() {
  const [tab, setTab] = useState<TabKey>('search');
  return (
    <main className="container space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-semibold">✨ AI Search Bot</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Search with citations · Image Gen · OCR · Streaming Chat · PDF Q&amp;A
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {[
          ['search', 'Search'],
          ['image', 'Image'],
          ['ocr', 'OCR'],
          ['chat', 'Chat (Streaming)'],
          ['pdf', 'PDF Q&A'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as TabKey)}
            className={clsx('tab', tab === k ? '' : 'inactive')}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'search' && <SearchPane />}
      {tab === 'image' && <ImagePane />}
      {tab === 'ocr' && <OCRPane />}
      {tab === 'chat' && <ChatPane />}
      {tab === 'pdf' && <PDFPane />}

      <footer className="text-xs text-zinc-500 pt-8">
        Built with OpenAI Responses, Images, Vision & Embeddings.
      </footer>
    </main>
  );
}

/* -------- Search -------- */
function SearchPane() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setLoading(true);
    setAnswer('');
    setSources([]);
    const resp = await fetch(`${API}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, max_results: 6, max_pages: 4, max_chars_per_doc: 4000 }),
    });
    const data = await resp.json();
    setAnswer(data.answer);
    setSources(data.sources || []);
    setLoading(false);
  };

  return (
    <div className="card space-y-3">
      <input
        className="input"
        placeholder="e.g., What changed in HTTP/3 vs HTTP/2?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="btn" onClick={ask} disabled={loading || !q.trim()}>
        {loading ? 'Thinking…' : 'Ask'}
      </button>
      {answer && (
        <div className="space-y-3">
          <div className="area">{answer}</div>
          {sources.length > 0 && (
            <div className="text-sm">
              <div className="font-medium">Sources</div>
              <ul className="list-disc pl-5">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a className="underline" href={s} target="_blank">
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

/* -------- Image -------- */
function ImagePane() {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const gen = async () => {
    setLoading(true);
    setImages([]);
    const resp = await fetch(`${API}/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024', n: 1 }),
    });
    const data = await resp.json();
    const imgs = (data.data || []).map((b64: string) => `data:image/png;base64,${b64}`);
    setImages(imgs);
    setLoading(false);
  };

  return (
    <div className="card space-y-3">
      <input
        className="input"
        placeholder="A cozy desk setup with neon lighting"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button className="btn" onClick={gen} disabled={loading || !prompt.trim()}>
        {loading ? 'Generating…' : 'Generate'}
      </button>
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map((src, i) => (
            <img key={i} src={src} alt={`gen-${i}`} className="rounded-xl border" />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------- OCR -------- */
function OCRPane() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const ocr = async () => {
    if (!file) return;
    setLoading(true);
    setText('');
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${API}/ocr`, { method: 'POST', body: fd });
    const data = await resp.json();
    setText(data.text || '(no text)');
    setLoading(false);
  };

  return (
    <div className="card space-y-3">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept="image/*" />
      <button className="btn" onClick={ocr} disabled={loading || !file}>
        {loading ? 'Reading…' : 'Run OCR'}
      </button>
      {text && <pre className="text-sm whitespace-pre-wrap bg-white/70 dark:bg-white/10 p-3 rounded-xl">{text}</pre>}
    </div>
  );
}

/* -------- Chat (streaming) -------- */
function ChatPane() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setTranscript((prev) => prev + `\n\nYou: ${message}\nAssistant: `);
    const resp = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
    const data = await resp.json();
    setSessionId(data.session_id);
    setTranscript((prev) => prev + data.answer);
    setMessage('');
    setLoading(false);
  };

  return (
    <div className="card space-y-3">
      <div className="text-xs text-zinc-500">
        Session: <span className="badge">{sessionId || 'new'}</span>
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask anything…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="btn" onClick={send} disabled={loading || !message.trim()}>
          {loading ? 'Thinking…' : 'Send'}
        </button>
      </div>
      <div className="area text-sm bg-white/70 dark:bg-white/10 rounded-xl p-3 min-h-[160px]">
        {transcript || 'Say hi 👋'}
      </div>
    </div>
  );
}

/* -------- PDF Q&A -------- */
function PDFPane() {
  const [docId, setDocId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [ans, setAns] = useState('');

  const upload = async () => {
    if (!file) return;
    setStatus('Uploading & indexing…');
    setAns('');
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${API}/pdf/upload`, { method: 'POST', body: fd });
    const data = await resp.json();
    if (data.doc_id) {
      setDocId(data.doc_id);
      setStatus(`Indexed ${data.chunks} chunks. Ready.`);
    } else {
      setStatus(data.error || 'Failed.');
    }
  };

  const ask = async () => {
    setAns('Thinking…');
    const resp = await fetch(`${API}/pdf/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, question: q, k: 6 }),
    });
    const data = await resp.json();
    setAns(data.answer || data.error || '(no answer)');
  };

  return (
    <div className="card space-y-3">
      <div className="text-sm">1) Upload a PDF → 2) Ask questions about its content</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="btn" onClick={upload} disabled={!file}>
          Upload & Index
        </button>
      </div>
      {status && <div className="text-xs text-zinc-600 dark:text-zinc-400">{status}</div>}
      {docId && (
        <div className="text-xs">
          doc_id: <span className="badge">{docId}</span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Your question about the PDF…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" onClick={ask} disabled={!docId || !q.trim()}>
          Ask
        </button>
      </div>
      {ans && <div className="area text-sm bg-white/70 dark:bg-white/10 rounded-xl p-3">{ans}</div>}
    </div>
  );
}
