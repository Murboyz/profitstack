import { getApiBase } from './config.js';

const API_BASE = getApiBase();
const STORAGE_KEY = 'profitstack_user_email';

function redirect(path, reason) {
  const url = new URL(path, window.location.href);
  if (reason) url.searchParams.set('reason', reason);
  window.location.href = url.toString();
}

export function getCurrentUserEmail() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setCurrentUserEmail(email) {
  localStorage.setItem(STORAGE_KEY, email);
}

export function clearCurrentUserEmail() {
  localStorage.removeItem(STORAGE_KEY);
}

export function requireLogin() {
  if (!getCurrentUserEmail()) {
    redirect('./login.html', 'missing-session');
    throw new Error('Login required');
  }
}

export function redirectToLogin(reason = 'login-required') {
  redirect('./login.html', reason);
}

export function redirectToUnauthorized(reason = 'unauthorized') {
  redirect('./unauthorized.html', reason);
}

export async function apiFetch(path, options = {}) {
  const email = getCurrentUserEmail();
  const headers = {
    ...(options.headers || {}),
    'X-User-Email': email,
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    clearCurrentUserEmail();
    redirectToUnauthorized('session-not-recognized');
    throw new Error('Unauthorized');
  }
  return response;
}
