import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

// Served with the app instead of from Google on every visit, so the first
// screen doesn't wait on another site
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto", display: "swap" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-roboto-mono", display: "swap" });

export const metadata = {
  title: "Watch Hunter",
  description: "Find eBay UK watch auctions you can resell at a profit",
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // Opens full screen when added to an iPhone home screen
  appleWebApp: {
    capable: true,
    title: "Watch Hunter",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body className="min-h-screen bg-zinc-950 font-sans text-white antialiased">
        {children}
      </body>
    </html>
  );
}
