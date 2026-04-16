import { setAccessToken, setCurrentUserEmail } from './auth.js';

async function getFrontendConfig() {
  const res = await fetch('/api/frontend-config');
  if (!res.ok) throw new Error(`Frontend config failed with ${res.status}`);
  return res.json();
}

const hash = new URLSearchParams(window.location.hash.slice(1));
const accessToken = hash.get('access_token');
const email = hash.get('email');
const next = new URLSearchParams(window.location.search).get('next');
if (accessToken) {
  setAccessToken(accessToken);
  if (email) setCurrentUserEmail(email);
}

document.getElementById('resetForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = document.getElementById('result');
  const password = document.getElementById('password').value;

  try {
    if (!accessToken) throw new Error('Missing recovery session. Request a new password-reset link.');
    const { supabaseUrl, supabaseAnonKey } = await getFrontendConfig();
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
