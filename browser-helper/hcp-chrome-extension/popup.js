const statusEl = document.getElementById('status');
const connectButton = document.getElementById('connectButton');
const accountLabelInput = document.getElementById('accountLabel');

function setStatus(message, kind = 'muted') {
  statusEl.className = `status card ${kind}`;
  statusEl.textContent = message;
}

function isNutReportUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host === 'thenutreport.com'
      || host.endsWith('.thenutreport.com')
      || host === 'localhost'
      || host === '127.0.0.1';
  } catch {
    return false;
  }
}

async function findNutReportTabs() {
  const tabs = await chrome.tabs.query({});
  const matches = tabs.filter((tab) => tab?.id && isNutReportUrl(tab.url || tab.pendingUrl || ''));
  matches.sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));
  if (matches.length) return matches;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id ? [activeTab] : [];
}

async function readNutReportSession(tabId) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const token = localStorage.getItem('profitstack_access_token') || '';
        const explicitApiBase = localStorage.getItem('profitstack_api_base') || '';
        const apiBase = explicitApiBase
          ? explicitApiBase.replace(/\/$/, '')
          : ((location.hostname === '127.0.0.1' || location.hostname === 'localhost')
            ? 'http://127.0.0.1:8787'
            : location.origin);
        return {
          token,
          apiBase,
          pageUrl: location.href,
        };
      },
    });
    return injection?.result || {};
  } catch {
    return {};
  }
}

async function getCookies(filter) {
  try {
    return await chrome.cookies.getAll(filter);
  } catch {
    return [];
  }
}

async function captureHousecallCookies() {
  const batches = await Promise.all([
    getCookies({ url: 'https://pro.housecallpro.com/' }),
    getCookies({ url: 'https://pro.housecallpro.com/app' }),
    getCookies({ domain: 'housecallpro.com' }),
    getCookies({ domain: 'pro.housecallpro.com' }),
  ]);
  const seen = new Set();
  const cookies = [];
  for (const item of batches.flat()) {
    if (!item?.name || !item?.value) continue;
    const key = `${item.name}|${item.domain}|${item.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cookies.push(item);
  }
  cookies.sort((a, b) => a.name.localeCompare(b.name));
  return cookies;
}

async function saveConnectionViaPage(tabId, payload) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [payload],
      func: async (helperPayload) => {
        const token = localStorage.getItem('profitstack_access_token') || '';
        const explicitApiBase = localStorage.getItem('profitstack_api_base') || '';
        const apiBase = explicitApiBase
          ? explicitApiBase.replace(/\/$/, '')
          : ((location.hostname === '127.0.0.1' || location.hostname === 'localhost')
            ? 'http://127.0.0.1:8787'
            : location.origin);

        if (!token) {
          return { ok: false, error: 'Missing profitstack_access_token in the Nut Report tab.' };
        }

        const response = await fetch(`${apiBase}/api/crm-connection/hcp-helper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(helperPayload),
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        return {
          ok: response.ok,
          status: response.status,
          data,
        };
      },
    });
    return injection?.result || { ok: false, error: 'No response returned from the Nut Report tab.' };
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not reach the Nut Report tab.' };
  }
}

connectButton.addEventListener('click', async () => {
  connectButton.disabled = true;
  setStatus('Looking for an open, logged-in Nut Report tab...');

  try {
    const tabs = await findNutReportTabs();
    let session = null;
    let nutReportTab = null;
    for (const tab of tabs) {
      const candidate = await readNutReportSession(tab.id);
      if (candidate?.token) {
        session = candidate;
        nutReportTab = tab;
        break;
      }
    }

    if (!session?.token || !nutReportTab?.id) {
      throw new Error('Keep a logged-in Nut Report tab open in this Chrome profile, then click the helper again. Housecall Pro can stay in front.');
    }

    setStatus(`Found Nut Report session on:\n${session.pageUrl}\n\nCapturing Housecall Pro cookies...`);
    const cookies = await captureHousecallCookies();
    if (!cookies.length) {
      throw new Error('No Housecall Pro cookies found. Log into pro.housecallpro.com in this same Chrome profile, then try again.');
    }

    const payload = {
      accountLabel: accountLabelInput.value.trim() || 'Primary Housecall Pro account',
      helperVersion: 2,
      capturedAt: new Date().toISOString(),
      cookies: cookies.map((item) => ({
        name: item.name,
        value: item.value,
        domain: item.domain,
        path: item.path,
        secure: item.secure,
        httpOnly: item.httpOnly,
        sameSite: item.sameSite,
        expirationDate: item.expirationDate,
      })),
      cookieHeader: cookies.map((item) => `${item.name}=${item.value}`).join('; '),
    };

    setStatus('Saving the Housecall Pro connection into The Nut Report...');
    const result = await saveConnectionViaPage(nutReportTab.id, payload);
    if (!result?.ok) {
      throw new Error(result?.data?.error || result?.error || `Connect failed (${result?.status || 'unknown'})`);
    }

    setStatus(`${result.data?.message || 'Housecall Pro connection saved.'}\n\nNext: go to the dashboard and click Refresh Data.`, 'ok');
  } catch (error) {
    setStatus(error.message || 'Connect failed.', 'error');
  } finally {
    connectButton.disabled = false;
  }
});
