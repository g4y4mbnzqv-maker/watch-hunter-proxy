import "./globals.css";
import { niche } from "@/lib/niche";

export const metadata = {
  title: niche.appName,
  description: niche.description,
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // Opens full screen when added to an iPhone home screen
  appleWebApp: {
    capable: true,
    title: niche.appName,
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
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@500&display=swap"
        />
      </head>
      <body className="min-h-screen bg-zinc-950 font-sans text-white antialiased">
        {children}
      </body>
    </html>
  );
}
