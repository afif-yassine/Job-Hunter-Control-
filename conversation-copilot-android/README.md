# ConvoPilot Android

Android-first conversation copilot that appears above the app you are already using.

## V1
- Quick Settings tile
- MediaProjection consent flow
- draggable AI overlay
- UNDERSTAND: multi-screen capture, ML Kit OCR, dedup, Gemini summary, Room memory
- REPLY: current screen + memory + recent supported notifications, tones, 3 replies, regenerate
- START: profile/context capture and 3 openers
- notification allow-list for major messaging/social apps
- local memory browser

## Gemini key
Create `.env` in the project root:

```env
GEMINI_API_KEY=your_real_key_here
```

`.env` is gitignored. This is fine for a private prototype, but before public distribution move the API key behind a backend or Firebase AI Logic/App Check because secrets embedded in APKs can be extracted.

## Build
Requirements: Android Studio, SDK 35, JDK 17+, Gradle 8.9.

```bash
cp .env.example .env
gradle testDebugUnitTest assembleDebug
```

## First launch
1. Enable Floating copilot overlay permission.
2. Optionally enable notification access.
3. Add the ConvoPilot Quick Settings tile.
4. Open Tinder/WhatsApp/Instagram/etc.
5. Pull Quick Settings and tap ConvoPilot.
6. Accept Android screen-sharing consent.
7. Use the floating AI button.

### UNDERSTAND
`AI → UNDERSTAND → Capture → scroll → Capture → Finish`

### REPLY
`AI → REPLY → tone → 3 replies → Copy / Regenerate`

### START
`AI → START → tone → 3 openers`

## Privacy behavior
- capture is user-triggered;
- overlay hides itself before capture;
- Gemini receives OCR text, not raw screenshots;
- no AccessibilityService in V1;
- no bypass of secure-screen protections;
- notification reading is restricted to an explicit messaging/social package allow-list.

## Architecture
`Quick Settings → MediaProjection → Overlay → ML Kit OCR → ContextMerger → Room memory + notifications → Gemini 2.5 Flash-Lite`
