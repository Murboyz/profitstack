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
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  try {
    const sessionRes = await fetch('/api/session', {
      headers: {
        ...(fallbackEmail ? { 'X-User-Email': fallbackEmail } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      if (session?.user?.role === 'admin' && session?.organization?.slug === 'the-nut-report-admin') {
        return './admin.html';
      }
    }

    const res = await fetch('/api/crm-connection', {
      headers: {
        ...(fallbackEmail ? { 'X-User-Email': fallbackEmail } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!res.ok) return next === 'dashboard-setup' ? './connect-crm.html?next=dashboard-setup' : './dashboard.html';
    const crmConnection = await res.json();
    if (next === 'dashboard-setup') {
      return crmConnection?.status === 'connected'
        ? './dashboard.html?setup=1&crm=connected'
        : './connect-crm.html?next=dashboard-setup';
    }
    return crmConnection?.status === 'connected' ? './dashboard.html' : './dashboard.html?crm=disconnected';
  } catch {
    return next === 'dashboard-setup' ? './connect-crm.html?next=dashboard-setup' : './dashboard.html';
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
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  window.history.replaceState({}, '', next ? `./login.html?next=${encodeURIComponent(next)}` : './login.html');
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

document.getElementById('forgotPasswordButton').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim().toLowerCase();
  const result = document.getElementById('result');

  try {
    if (!email) throw new Error('Enter your email first.');
    const { supabaseUrl, supabaseAnonKey } = await getFrontendConfig();
    const redirectTo = `${window.location.origin}/reset-password.html`;
    const res = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ email, redirect_to: redirectTo }),
    });
    if (!res.ok) throw new Error(`Reset email failed with ${res.status}`);
    result.textContent = 'Password reset email sent. Check your inbox and use the link to set a new password.';
  } catch (error) {
    result.textContent = `Could not send reset email: ${error.message}`;
  }
});
