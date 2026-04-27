import { getAccessToken, getCurrentUserEmail, setCurrentUserEmail } from './auth.js';
import { fetchFrontendConfig } from './config.js';

// `auth.js` runs first: `consumeAuthHash()` moves `#access_token` into
// localStorage and clears the hash. Reading the hash here would miss the
// token — use `getAccessToken()` for the reset flow.
const next = new URLSearchParams(window.location.search).get('next');
const hash = new URLSearchParams(window.location.hash.slice(1));
const emailFromHash = hash.get('email');
if (emailFromHash && !getCurrentUserEmail()) {
  setCurrentUserEmail(emailFromHash);
}

const resultEl = document.getElementById('result');
if (!getAccessToken()) {
  resultEl.textContent = 'Open the password-reset link from your email (or request a new one on the login page). If you already used the link, the session may have expired.';
}

document.getElementById('resetForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = document.getElementById('result');
  const password = document.getElementById('password').value;

  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('Missing recovery session. Request a new password-reset link from the login page.');
    }
    const { supabaseUrl, supabaseAnonKey } = await fetchFrontendConfig();
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error(`Password save failed with ${res.status}`);
    const destination = next === 'dashboard-setup'
      ? './dashboard.html?setup=1&crm=connected'
      : './dashboard.html';
    result.innerHTML = `<p>Password saved.</p><p><a href="${destination}">Go To Dashboard</a></p>`;
  } catch (error) {
    result.textContent = `Password setup failed: ${error.message}`;
  }
});
