import { getAccessToken, getCurrentUserEmail, setAccessToken, setCurrentUserEmail } from './auth.js';
import { fetchFrontendConfig } from './config.js';

const params = new URLSearchParams(window.location.search);
const next = params.get('next');
const crmConnected = params.get('crm') === 'connected';
const dashboardHref = next === 'dashboard-setup' ? './dashboard.html?setup=1&crm=connected' : './dashboard.html';
const loginHref = next === 'dashboard-setup'
  ? './login.html?next=dashboard-setup'
  : './login.html';

const existingEmail = getCurrentUserEmail();
if (existingEmail) {
  document.getElementById('email').value = existingEmail;
}

document.getElementById('loginLink').href = loginHref;
document.getElementById('dashboardLink').href = dashboardHref;
document.getElementById('dashboardLink').addEventListener('click', (event) => {
  if (!getCurrentUserEmail() && !getAccessToken()) {
    event.preventDefault();
    window.location.href = loginHref;
  }
});

if (crmConnected) {
  document.getElementById('crmReturnNote').hidden = false;
  document.getElementById('dashboardLink').classList.add('next-action');
}

document.getElementById('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const result = document.getElementById('result');
  const button = document.getElementById('createPasswordButton');

  if (!email) {
    result.textContent = 'Enter the email you used for purchase.';
    return;
  }
  if (password.length < 8) {
    result.textContent = 'Use a password with at least 8 characters.';
    return;
  }
  if (password !== confirmPassword) {
    result.textContent = 'Passwords do not match.';
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'Saving password…';
    result.textContent = '';
    const passwordRes = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const passwordData = await passwordRes.json();
    if (!passwordRes.ok) {
      throw new Error(passwordData.error || `Password setup failed with ${passwordRes.status}`);
    }

    const { supabaseUrl, supabaseAnonKey } = await fetchFrontendConfig();
    setCurrentUserEmail(email);
    const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.access_token) {
      throw new Error(loginData.error_description || loginData.error || `Sign-in failed with ${loginRes.status}`);
    }

    setAccessToken(loginData.access_token);
    result.textContent = 'Password saved. Redirecting…';
    window.location.href = dashboardHref;
  } catch (error) {
    button.disabled = false;
    button.textContent = 'This is my first sign-in, set my password';
    result.textContent = error.message || 'Password setup failed.';
  }
});
