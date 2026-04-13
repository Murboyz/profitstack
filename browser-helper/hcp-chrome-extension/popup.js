const statusEl = document.getElementById('status');
const connectButton = document.getElementById('connectButton');
const accountLabelInput = document.getElementById('accountLabel');

function setStatus(message, kind = 'muted') {
  statusEl.className = `status card ${kind}`;
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function readNutReportSession(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
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

  return result || {};
}

async function captureHousecallCookies() {
  const cookies = await chrome.cookies.getAll({ domain: 'pro.housecallpro.com' });
  return cookies
    .filter((item) => item?.name && item?.value)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function saveConnectionViaPage(tabId, payload) {
  const [{ result }] = await chrome.scripting.executeScript({
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
        return { ok: false, error: 'Missing profitstack_access_token in the active Nut Report tab.' };
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

  return result || { ok: false, error: 'No response returned from the active Nut Report tab.' };
}

connectButton.addEventListener('click', async () => {
  connectButton.disabled = true;
  setStatus('Checking the active tab for a live Nut Report session...');

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error('No active tab found.');
    }

    const session = await readNutReportSession(tab.id);
    if (!session?.token) {
      throw new Error('Open a logged-in Nut Report dashboard or CRM tab, then click the helper again.');
    }

    setStatus(`Found Nut Report session on:\n${session.pageUrl}\n\nCapturing Housecall Pro cookies...`);
    const cookies = await captureHousecallCookies();
    if (!cookies.length) {
      throw new Error('No Housecall Pro cookies found. Make sure you are logged into pro.housecallpro.com in this same Chrome profile.');
    }

    const payload = {
      accountLabel: accountLabelInput.value.trim() || 'Primary Housecall Pro account',
      helperVersion: 1,
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

    setStatus('Saving the Housecall Pro connection into ProfitStack...');
    const result = await saveConnectionViaPage(tab.id, payload);
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
