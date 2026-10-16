// Optional ElevenLabs voice. Without a key, the client uses the browser's own voice.
export async function GET() {
  return Response.json({ available: !!process.env.ELEVENLABS_API_KEY });
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("no voice configured", { status: 404 });
  const { text } = (await req.json()) as { text?: string };
  if (!text) return new Response("no text", { status: 400 });
  const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // George
  // Slower, warmer: lengthen the pauses between sentences and ease the pace.
  const slow = text.slice(0, 900).replace(/\. /g, "... ").replace(/, /g, ",  ");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text: slow, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.85, similarity_boost: 0.75, style: 0.05, speed: 0.8 } }),
  });
  if (!r.ok) return new Response("voice failed", { status: 502 });
  return new Response(r.body, { headers: { "content-type": "audio/mpeg" } });
}
