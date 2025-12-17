import "./globals.css";

export const metadata = {
  title: "JUP Gift Finder",
  description: "Find jup.ag/gift tweets using X API",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
