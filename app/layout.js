import "./globals.css";

export const metadata = {
  title: "Watch Hunter",
  description: "Find underpriced watch auctions on eBay UK",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body className="m-0 bg-zinc-950 text-white font-sans">{children}</body>
    </html>
  );
}
