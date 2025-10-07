import "./globals.css";

export const metadata = {
  title: "AI Search Bot",
  description: "Clean, fast, and beautifully simple — like an Apple app.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: { title: "AI Search Bot", description: "Ask. See. Cite.", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Top glass nav */}
        <header className="fixed top-0 inset-x-0 z-40 backdrop-blur bg-white/70 dark:bg-black/30 border-b border-black/10 dark:border-white/10">
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-2xl bg-gradient-to-br from-sky to-lilac shadow-soft ring-1 ring-white/30" />
              <span className="text-[17px] font-semibold tracking-tight">AI Search Bot</span>
            </div>
            <a
              href="https://parmishsahni.onrender.com/health"
              target="_blank"
              className="text-sm text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white transition"
            >
              API Status
            </a>
          </div>
        </header>

        {/* Hero gradient + rings */}
        <div className="pt-24 ring-wrap">
          <main className="container pb-20">
            {children}
          </main>
        </div>

        <footer className="container pb-10 text-xs text-black/60 dark:text-white/60">
          © {new Date().getFullYear()} Parmish • Built with Next.js + FastAPI
        </footer>
      </body>
    </html>
  );
}
