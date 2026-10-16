#!/bin/zsh
# Speaks Oriel's opening line in several stock ElevenLabs voices and plays each one.
# Usage: scripts/audition.sh            (reads ELEVENLABS_API_KEY from .env.local)
set -e; cd "$(dirname "$0")/.."
K=$(grep '^ELEVENLABS_API_KEY=' .env.local | cut -d= -f2); OUT=.audition; mkdir -p $OUT
TEXT='I am Oriel. Five hundred twenty-eight hertz in the left ear, lifted by seven point eight three in the right. Where they meet, the door opens. Breathe. You are expected here.'
for pair in sarah:EXAVITQu4vr4xnSDxMaL lily:pFZP5JQG7iQjIQuC4Bku matilda:XrExE9yKIg1WjnnlVkGX charlotte:XB0fDUlXrN03Wm1x8I1R george:JBFqnCBsd6RMkjVDRZzb daniel:onwK4e9ZLuTAKqWW03F9 brian:nPczCjzI2devNBz1zQrb; do
  n=${pair%%:*}; id=${pair##*:}
  curl -sf -o $OUT/$n.mp3 -X POST "https://api.elevenlabs.io/v1/text-to-speech/$id?output_format=mp3_44100_64" -H "xi-api-key: $K" -H 'content-type: application/json' \
    -d "{\"text\":\"$TEXT\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.75,\"similarity_boost\":0.6,\"style\":0.15}}" || { echo "$n failed"; continue; }
  echo "▶ $n ($id)"; afplay $OUT/$n.mp3
done
echo "Pick one and set ELEVENLABS_VOICE_ID=<id> in .env.local"
