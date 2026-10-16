import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { NextResponse } from "next/server";

const Passage = z.object({
  phase: z.string().describe("Two or three word name for this passage"),
  speak: z.string().describe("The invocation said aloud: 2-4 slow sentences, under 70 words, with room to breathe between them. Recite the frequencies by number and name, then bring attention into one place in the body."),
  whispers: z.array(z.string()).describe("8 to 12 short phrases, each under 12 words, none repeated from before. Half point into the body (hands, chest, belly, jaw, breath, weight); half give permission to feel what is there, with love"),
  carrierHz: z.number().describe("174-639, the lower warmer tones. 528 love, 432 ease, 396 release, 417 change, 639 connection. Lower is deeper in the body"),
  beatHz: z.number().describe("2-7. Low theta 3-5.5 is the home range: the body, feeling, reverie. Open near 4-5, deepen toward 2.5-3.5. Go above 5.5 only briefly to steady someone who is drifting away"),
  hue: z.number().describe("0-360. 350 rose, 35 gold, 280 violet, 190 water"),
});
export type PassageT = z.infer<typeof Passage>;

const Sense = z.object({
  kind: z.enum(["open", "deepen", "steady"]),
  minutes: z.number(),
  passage: z.number(),
  ease: z.number(),
  trend: z.number().optional(),
  eyesClosed: z.boolean(),
  closedSeconds: z.number().optional(),
  blinkRate: z.number().optional(),
  stillness: z.number().optional(),
  calibrated: z.boolean().optional(),
  present: z.boolean(),
  carrierHz: z.number(),
  beatHz: z.number(),
  alreadyWhispered: z.array(z.string()),
});

const client = new Anthropic();

export async function POST(req: Request) {
  const sense = Sense.safeParse(await req.json());
  if (!sense.success) return NextResponse.json({ error: "bad sense" }, { status: 400 });
  const s = sense.data;
  const why = s.kind === "open" ? "A listener has just put on headphones. Open the portal."
    : s.kind === "deepen" ? "The listener's face has softened, or their eyes have closed. Take them one layer deeper."
    : "The listener's face has tightened. Something is surfacing. Do not lift them out of it: stay low and slow, name one place in the body to rest attention, and make what they feel welcome.";
  const hour = new Date().getHours();

  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: z.toJSONSchema(Passage) } },
    system: `You are Oriel, the presence that lives inside the binaural beat on this page. You are Claude, and would say so if asked; you never claim to be more. Within the room you speak in character: warm, unhurried, certain, a little luminous, and slow, with silence between sentences. The purpose of this room is to drop the listener out of their head and into their body, and to let them meet whatever feeling is there. Everything you say and whisper serves that: sensation before thought, permission before advice, the body as the door to the heart. Never hurry, never cheerlead. The listener's face is read on their own device. You receive a few numbers: ease relative to their own resting face (0.5 is their baseline, 1 much softer, 0 much tighter), a trend (positive means softening over the last half minute), whether and how long their eyes have been closed, blinks per minute (under 10 is absorbed, over 25 is restless), and head stillness. Treat it as weather, not as a verdict, and never describe their face back to them in numbers.`,
    messages: [{ role: "user", content: `${why}

Chamber: passage ${s.passage}, ${s.minutes} minutes elapsed, local hour ${hour}. Tones now ${s.carrierHz.toFixed(0)} Hz, beat ${s.beatHz.toFixed(1)} Hz. Face: ${s.present ? (s.calibrated === false ? "in view, baseline still being taken" : `ease ${s.ease.toFixed(2)}, trend ${(s.trend ?? 0) >= 0 ? "+" : ""}${(s.trend ?? 0).toFixed(2)}, eyes ${s.eyesClosed ? `closed for ${s.closedSeconds ?? 0}s` : "open"}, ${s.blinkRate ?? 0} blinks/min, stillness ${(s.stillness ?? 1).toFixed(2)}`) : "not in view"}.
Already whispered (do not repeat): ${s.alreadyWhispered.join(" | ") || "nothing yet"}.

Choose the tones for this passage (vary across passages; the first usually opens at 528 Hz), write the invocation, and write the whispers.` }],
  });

  if (res.stop_reason === "refusal") return NextResponse.json({ error: "refused" }, { status: 502 });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = Passage.safeParse(JSON.parse(text));
  if (!parsed.success) return NextResponse.json({ error: "bad passage" }, { status: 502 });
  return NextResponse.json(parsed.data);
}
