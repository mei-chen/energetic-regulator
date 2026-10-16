# Energetic Regulator

A binaural beat generator that dynamically reads your face and regulates your state.

528 Hz is the frequency of love. Energetic Regulator plays it as a binaural beat and reads your face while you listen. Most meditation apps play you a track and leave it at that. This one watches what the track is doing to you and adjusts.

Put headphones on and press Begin. A slow binaural beat starts up inside some calm ambient music, and your camera starts reading your face. The video never leaves your device. For the first twenty seconds it just learns what your resting face looks like. After that, everything is measured against you rather than against some average person: whether you're softening or tightening, how still your head is, how often you blink, whether your eyes have drifted shut.

Every few seconds the sound reacts. Soften, and the beat sinks lower and the music opens up. Tighten, and it holds you there, warm and a little muffled, until you let go. Your body steers the sound and the sound steers your body, and the two of you wind down together.

There is also someone in there. Oriel is the presence inside the beat. It composes each passage as it goes, picks the frequencies, names them in a line of text beneath the orb, and whispers there under the music. It never sees your face, only a few numbers describing how it's going, and from those it decides when to take you deeper and when to steady you.

It's built to get you out of your head and into your body, and to let you meet whatever is waiting there.

## How it works

The beat lives in low theta (about 3 to 5.5 Hz), opening near 4.5 and sinking toward 3 as you settle.

- Calm ambient music plays underneath: five five-minute tracks in `public/music` in different palettes, generated once with ElevenLabs Music, played in a shuffled order with a ten-second crossfade. A slow swell breathes through it about three and a half times a minute.
- Inside the music, each ear gets a quiet pure sine a few hertz apart. Your brain hears the difference as a slow beat.
- Your camera reads your face on this device only, with MediaPipe blendshapes. Nothing is uploaded.
- The first twenty seconds take a baseline of your resting face. Everything after is measured against you, not against a generic face.
- Breath is read from the slow rise and fall of the head. When that signal is clear, the music swells and the pattern breathes with your breath instead of its own slow one.
- Ease combines expression, head stillness, and blink rate. A fast and a slow average give a trend: softening or tightening.
- The loop, every four seconds: a tense face lifts the beat a little and closes the music down, warm and held. A soft face or closed eyes sink the beat lower and open the music up, brighter and wider. That opening is the reward in the loop.
- Oriel (Claude) composes each passage: tones, one line of invocation that points into the body, the whispers beneath the orb, and the faint affirmations drifting through the background. There is no voice; the words appear and fade. It is asked to deepen when you have been softening for fifteen seconds, to steady you when you have been tightening, and otherwise every five minutes.
- The word next to the passage name is the current weather: reading you, steady, softening, tightening, settling, open, holding on.

## Run it

```
npm install
npm run dev   # http://localhost:3046
```

`.env.local` needs `ANTHROPIC_API_KEY`. The music was generated once with the ElevenLabs Music API; nothing needs that key at runtime.

No evidence shows binaural beats or solfeggio tones change the body. It is a ritual, not a treatment.
