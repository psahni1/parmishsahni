export const metadata = {
  title: "AI Search Bot",
  description: "Search + Vision + Images + Chat + PDF Q&A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
