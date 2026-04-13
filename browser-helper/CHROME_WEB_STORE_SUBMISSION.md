# ProfitStack HCP Helper, Chrome Web Store submission

## Goal
Publish the Housecall Pro Chrome helper so clients can install it without Chad manually walking them through `chrome://extensions` and `Load unpacked`.

## What is already built
- Chrome helper extension scaffold exists in `browser-helper/hcp-chrome-extension/`
- Backend helper endpoint exists for session capture
- CRM page/client flow now assumes helper-based connect is the primary desktop path

## Remaining path to live install
1. Create the extension ZIP package
2. Upload it in the Chrome Developer Dashboard
3. Fill out store listing
4. Fill out privacy declarations
5. Submit for review
6. After approval, use the install link in The Nut Report onboarding

## Package the extension
From repo root:

```bash
cd browser-helper
bash package-extension.sh
```

Output:
- `browser-helper/dist/profitstack-hcp-helper.zip`

## Chrome Web Store requirements still needed
- Chrome Developer account access
- One-time upload of the ZIP package
- Store listing copy
- Privacy declarations matching cookie/session capture behavior
- Any required icons/screenshots if the dashboard rejects the package without them

## Draft single-purpose statement
This extension captures the currently authenticated Housecall Pro browser session in Chrome and sends it to The Nut Report for the signed-in user so the app can sync reporting data.

## Draft privacy behavior statement
- Reads Housecall Pro cookies from `pro.housecallpro.com`
- Reads the active The Nut Report access token from the currently open Nut Report tab
- Sends captured session data only to the logged-in user's Nut Report backend
- Does not sell data or use it for advertising
- Purpose is limited to connecting Housecall Pro for reporting sync

## Draft test instructions for Chrome review
1. Log into The Nut Report in one Chrome tab.
2. Log into Housecall Pro in the same Chrome profile.
3. Open the extension popup.
4. Click `Capture HCP session and connect`.
5. Verify success message appears.
6. Return to The Nut Report and refresh dashboard data.

## Important truth
Until the Web Store version is live, the helper is still technical, not self-serve client-ready.
