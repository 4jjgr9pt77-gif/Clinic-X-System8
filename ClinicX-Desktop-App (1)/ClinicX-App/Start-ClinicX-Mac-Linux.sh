#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Clinic X server..."
node server.js &
SERVER_PID=$!
sleep 2

URL="http://localhost:3000"
echo "Opening Clinic X App window..."

if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app="$URL" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium --app="$URL" >/dev/null 2>&1 &
elif [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL"
else
  open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null
fi

echo "Clinic X is running. Press Ctrl+C to stop."
wait $SERVER_PID
