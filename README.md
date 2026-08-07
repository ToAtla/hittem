# Hittem

A swipe-to-decide contact app. Open it, get one person at a time, swipe right to call them now or left to skip. It records what you do so the people you have gone longest without calling float to the top next time.

Two implementations live here:

- `web/` — the shipped app: a client-side PWA (add to home screen via Safari), deployed to https://hittem.site via Vercel and to https://toatla.github.io/hittem/ by `.github/workflows/pages.yml`. Contacts come from a vCard import, Google Contacts, or manual entry; decisions live in browser storage. Contacts can be tagged local/distant and the deck filtered to either or both.
- `HITTEM/` — the native SwiftUI app (parked; requires Developer Mode on the phone, which managed Screen Time restrictions block).

## Google sign-in and Contacts

Off by default. With `web/config.js` carrying an empty `googleClientId`, the app runs exactly as it always has: no sign-in gate, no requests, nothing leaves the device. Filling the ID in turns on a sign-in gate and a Google Contacts import.

Setup:

1. In the Google Cloud console, create a project and enable the **People API**.
2. Under **OAuth consent screen**, choose External, and add your own Google account under **Test users**. Staying in Testing mode avoids app verification, at the cost of a 100-user cap.
3. Under **Credentials**, create an **OAuth client ID** of type **Web application**.
4. Add the origins you serve from to **Authorized JavaScript origins**. The token flow used here checks origins, not redirect URIs:
   - `https://hittem.site`
   - `https://www.hittem.site`
   - `http://localhost:4173` (only if you preview locally)
5. Paste the client ID into `web/config.js`.

The client ID is public by design and safe to commit. There is no client secret, and there must never be one: a browser app is a public client and cannot keep a secret.

What it does and does not do:

- Requests `contacts.readonly`. The app reads contacts and never writes to them.
- Imports name, best phone number, the **Notes** field, and local/distant tags from contact groups of those names, matching the existing vCard behaviour.
- Stores each contact's Google resource name, so a later sync can write back to the right card without re-matching on phone number.
- Access tokens are held in memory only and never written to storage. The identity session is stored so the app opens offline.

The gate is an access gate, not a confidentiality boundary. Contacts and history still sit unencrypted in `localStorage`, readable by anyone with the unlocked device or a devtools window. It keeps the deck out of casual view; it is not protection against someone holding the phone. Real confidentiality requires a backend holding the data, which is not built.

## Native app scope

- Reads your Contacts (anyone with a phone number).
- Card deck, swipe right = call (`tel:`), swipe left = skip.
- After a call it asks one tap: Reached / No answer.
- Ranks people you have never actioned first, then by who you have gone longest without calling.
- Stores all decisions locally with SwiftData. Nothing leaves the phone.

## Why it builds history going forward, not backward

iOS does not let a third-party app read your call log, SMS/iMessage, or WhatsApp/Telegram/Signal/Messenger history. There is no public API for any of it. So HITTEM records your contact attempts from first launch instead of importing the past. Pulling real history would require a separate macOS companion app reading local databases with Full Disk Access (a possible later phase).

## Build and run

The Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```sh
brew install xcodegen   # one time
xcodegen generate       # creates HITTEM.xcodeproj
open HITTEM.xcodeproj
```

In Xcode: select the HITTEM target, Signing & Capabilities, pick your personal team (free Apple ID). Plug in your iPhone, choose it as the run destination, and press Run. With a free Apple ID the install lasts 7 days before it needs re-running from Xcode.
