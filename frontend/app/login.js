import { setCurrentUserEmail, getCurrentUserEmail, clearCurrentUserEmail, setAccessToken } from './auth.js';

const reasonMessages = {
  'missing-session': 'Sign in to continue.',
  'session-not-recognized': 'That session is no longer valid. Choose an approved user and sign in again.',
  'login-required': 'Sign in to continue.',
};

const reason = new URLSearchParams(window.location.search).get('reason');
if (reason) {
  document.getElementById('result').textContent = reasonMessages[reason] || 'Sign in to continue.';
}

async function getFrontendConfig() {
  const res = await fetch('/api/frontend-config');
  if (!res.ok) throw new Error(`Frontend config failed with ${res.status}`);
  return res.json();
}

async function getPostLoginDestination(accessToken, fallbackEmail = '') {
  try {
    const res = await fetch('/api/crm-connection', {
      headers: {
        ...(fallbackEmail ? { 'X-User-Email': fallbackEmail } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!res.ok) return './dashboard.html';
    const crmConnection = await res.json();
    return crmConnection?.status === 'connected' ? './dashboard.html' : './dashboard.html?crm=disconnected';
  } catch {
    return './dashboard.html';
  }
}

async function completeMagicLinkLogin() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get('access_token');
  if (!accessToken) return;

  const { supabaseUrl, supabaseAnonKey } = await getFrontendConfig();
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userRes.ok) throw new Error(`Magic link session failed with ${userRes.status}`);
  const user = await userRes.json();
  setAccessToken(accessToken);
  setCurrentUserEmail(user.email);
  window.history.replaceState({}, '', './login.html');
  window.location.href = await getPostLoginDestination(accessToken, user.email);
}

completeMagicLinkLogin().catch((error) => {
  document.getElementById('result').textContent = `Magic link failed: ${error.message}`;
});

const existing = getCurrentUserEmail();
if (existing) {
  document.getElementById('email').value = existing;
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const result = document.getElementById('result');

  try {
    const { supabaseUrl, supabaseAnonKey } = await getFrontendConfig();
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Password sign-in failed with ${res.status}`);
    const data = await res.json();
    setAccessToken(data.access_token);
    setCurrentUserEmail(email);
    result.textContent = 'Signed in. Redirecting…';
    window.location.href = await getPostLoginDestination(data.access_token, email);
  } catch (error) {
    clearCurrentUserEmail();
    result.textContent = `Login failed: ${error.message}`;
  }
});

