import type { Metadata } from "next";

export const metadata: Metadata = { title: "Energetic Regulator · scan" };

// A page to put on a screen: a QR code that opens the room.
export default function QR() {
  return (
    <main className="qrpage">
      <div className="qrcard">
        <div className="qrline">528 Hz is the frequency of love.</div>
        <a href="https://energetic-regulator.vercel.app" className="qrbox">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qr.svg" alt="QR code for energetic-regulator.vercel.app" />
        </a>
        <div className="qrurl">energetic-regulator.vercel.app</div>
        <div className="qrhint">headphones preferred · camera on</div>
      </div>
    </main>
  );
}
