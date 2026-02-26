export default function RootLayout({ children }) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          background: "#0f0f0f",
          color: "#fff",
          fontFamily: "system-ui",
        }}
      >
        {children}
      </body>
    </html>
  );
}