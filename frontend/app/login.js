import { setCurrentUserEmail, getCurrentUserEmail, clearCurrentUserEmail, apiFetch } from './auth.js';

const reasonMessages = {
  'missing-session': 'Sign in to continue.',
  'session-not-recognized': 'That session is no longer valid. Choose an approved user and sign in again.',
  'login-required': 'Sign in to continue.',
};

const reason = new URLSearchParams(window.location.search).get('reason');
if (reason) {
  document.getElementById('result').textContent = reasonMessages[reason] || 'Sign in to continue.';
}

const existing = getCurrentUserEmail();
if (existing) {
  document.getElementById('email').value = existing;
}

document.getElementById('preset').addEventListener('change', (event) => {
  if (event.target.value !== 'custom') {
    document.getElementById('email').value = event.target.value;
  }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const result = document.getElementById('result');
  setCurrentUserEmail(email);

  try {
    const res = await apiFetch('/api/session');
    if (!res.ok) throw new Error(`Login failed with ${res.status}`);
    const session = await res.json();
    result.textContent = `Signed in as ${session.user.email} · ${session.organization.name}`;
    window.location.href = './index.html';
  } catch (error) {
    clearCurrentUserEmail();
    result.textContent = `Login failed: ${error.message}`;
  }
});
