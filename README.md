# HITTEM

A swipe-to-decide contact app. Open it, get one person at a time, swipe right to call them now or left to skip. It records what you do so the people you have gone longest without calling float to the top next time.

## Phase 1 scope

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
