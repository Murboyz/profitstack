import { getApiBase } from './config.js';

const API_BASE = getApiBase();
const STORAGE_KEY = 'profitstack_user_email';
const TOKEN_STORAGE_KEY = 'profitstack_access_token';

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

export function getAccessToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function setAccessToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearCurrentUserEmail() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function requireLogin() {
  if (!getCurrentUserEmail() && !getAccessToken()) {
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
  const accessToken = getAccessToken();
  const headers = {
    ...(options.headers || {}),
    ...(email ? { 'X-User-Email': email } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    clearCurrentUserEmail();
    redirectToUnauthorized('session-not-recognized');
    throw new Error('Unauthorized');
  }
  return response;
}
