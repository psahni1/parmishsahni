export const metadata = {
  title: "AI Search Bot",
  description: "Search with citations · Vision OCR · Images · PDF Q&A",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "AI Search Bot",
    description: "Ask, cite, see, and create.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="relative">
          {/* soft header gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-200/50 dark:from-indigo-900/30 blur-3xl" />
          <header className="container pt-8 pb-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-2xl bg-indigo-600 shadow-md ring-1 ring-white/20 dark:ring-black/20" />
                <div>
                  <h1 className="text-xl font-semibold leading-tight">AI Search Bot</h1>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Fast • Accurate • Cited</p>
                </div>
              </div>
              <a
                href="https://parmishsahni.onrender.com/health"
                target="_blank"
                className="badge"
              >
                API Status
              </a>
            </div>
          </header>
        </div>
        <main className="container pb-16">{children}</main>
        <footer className="container pb-10 text-xs text-zinc-500">
          © {new Date().getFullYear()} AI Search Bot · Built with Next.js + FastAPI
        </footer>
      </body>
    </html>
  );
}
