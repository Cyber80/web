
# English Practice • Primary (P1–6)

Mini web app (no frameworks) for Thai primary students to practice **reading, speaking, and writing** English.

## Files
- `index.html` — home & level selector
- `read.html` — flashcards, short sentences, short passages with TTS
- `speak.html` — listen & repeat (uses Web Speech API when available)
- `write.html` — dictation + sentence jumble
- `css/style.css` — styles
- `js/data.js` — word banks & passages
- `js/utils.js` — helpers (TTS, WER, shuffle)

## Notes
- Works offline in modern browsers. Text-to-Speech (TTS) uses `speechSynthesis`.
- Speech Recognition (microphone scoring) requires browsers that support the Web Speech API (best on Chromium). iOS Safari may not support it yet; the app will fall back to listen-and-repeat without scoring.
- No external libraries, easy to host on GitHub Pages.

## How to use
1. Upload the folder to your GitHub repo and enable GitHub Pages (root or `/docs`).
2. Open `index.html` to start.
3. Edit `js/data.js` to add your own words/sentences.
