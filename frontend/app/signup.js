import { getAccessToken, getCurrentUserEmail, setCurrentUserEmail } from './auth.js';

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

function getResetRedirect() {
  const url = new URL('./reset-password.html', window.location.href);
  if (next === 'dashboard-setup') {
    url.searchParams.set('next', 'dashboard-setup');
  }
  if (crmConnected) {
    url.searchParams.set('crm', 'connected');
  }
  return url.toString();
}

document.getElementById('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const result = document.getElementById('result');
  const button = document.getElementById('createPasswordButton');

  if (!email) {
    result.textContent = 'Enter the email you used for purchase.';
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'Opening password setup…';
    result.textContent = '';
    const res = await fetch('/api/auth/recovery-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        redirectTo: getResetRedirect(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.actionLink) {
      throw new Error(data.error || `Password setup failed with ${res.status}`);
    }
    setCurrentUserEmail(email);
    result.textContent = 'Opening password setup…';
    window.location.href = data.actionLink;
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Create sign in and password';
    result.textContent = error.message || 'Password setup failed.';
  }
});
