import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Energetic Regulator", description: "A binaural beat generator that reads your face and regulates your state." };
export const viewport: Viewport = { themeColor: "#07050a", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* the font is linked here rather than imported in CSS: the production CSS pipeline drops the @import */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
