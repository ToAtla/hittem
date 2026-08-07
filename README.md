# Hittem

A swipe-to-decide contact app. Open it, get one person at a time, swipe right to call them now or left to skip. It records what you do so the people you have gone longest without calling float to the top next time.

`web/` holds the app: a client-side PWA (add to home screen via Safari), deployed to https://hittem.site on every push to `main`. Vercel builds from the repo root and serves `web/` as the output directory, per `vercel.json`. Contacts come from a vCard import, Google Contacts, or manual entry; decisions live in browser storage. Contacts can be tagged local/distant and the deck filtered to either or both.

Storage is per-origin, so history does not follow you between domains. Moving devices or domains means **Export backup** on the old one and **Restore backup** on the new.

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

## Why it builds history going forward, not backward

Neither a browser nor a third-party iOS app can read your call log, SMS/iMessage, or WhatsApp/Telegram/Signal/Messenger history. There is no public API for any of it. So Hittem records your contact attempts from first use instead of importing the past.
