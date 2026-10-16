import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Oriel", description: "A presence in the beat. Headphones on." };
export const viewport: Viewport = { themeColor: "#07050a", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
