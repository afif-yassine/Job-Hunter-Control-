# Privacy design notes

ConvoPilot handles private conversation data, so V1 is deliberately user-triggered.

- Screen capture starts only after Android MediaProjection consent.
- Floating UI hides before capture.
- Captures live in private internal app storage.
- Notification ingestion is limited to an explicit package allow-list.
- Memory is stored locally in Room.
- Gemini receives OCR-derived text, not raw screenshots.
- No AccessibilityService in V1.
- No attempt to bypass FLAG_SECURE or other capture protections.

Before production add encrypted storage, automatic capture deletion after OCR, per-app toggles, a delete-all privacy dashboard, and a server-side Gemini credential or Firebase AI Logic/App Check.
