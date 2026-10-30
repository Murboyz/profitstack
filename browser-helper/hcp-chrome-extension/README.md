# ProfitStack HCP Chrome Helper

Small unpacked Chrome extension for the first real Housecall Pro session capture path.

## What it does

1. Finds an open logged-in Nut Report tab in this Chrome profile. Housecall Pro can be the tab in front.
2. Reads Housecall Pro cookies that would be sent to `pro.housecallpro.com`, including cookies set on `.housecallpro.com`.
3. Sends those cookies to `POST /api/crm-connection/hcp-helper` as the current Nut Report user.
4. ProfitStack stores the session in the existing `crm_connections` model.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `browser-helper/hcp-chrome-extension/`

## Manual test steps

1. In Chrome, log into **The Nut Report** and leave that tab open.
2. In the same Chrome profile, log into **Housecall Pro** at `https://pro.housecallpro.com/app`. Either tab can be in front.
3. Click the **ProfitStack HCP Helper** extension icon.
4. Click **Capture HCP session and connect**.
5. Wait for the green success message.
6. Go back to The Nut Report dashboard and click **Refresh Data**.

## Notes

- This is intentionally scoped to **Chrome desktop + Housecall Pro only**.
- A logged-in Nut Report tab must stay open. The helper finds that tab even when Housecall Pro is in front.
- If Housecall Pro logs out or rotates the session, run the helper again to reconnect.
