// Lets phones install the app to the home screen and open it full screen
export default function manifest() {
  return {
    name: "Watch Hunter",
    short_name: "Watch Hunter",
    description: "Find eBay UK watch auctions you can resell at a profit",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
