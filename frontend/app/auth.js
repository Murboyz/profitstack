import { getApiBase } from './config.js';

const API_BASE = getApiBase();
const STORAGE_KEY = 'profitstack_user_email';
const TOKEN_STORAGE_KEY = 'profitstack_access_token';
const BILLING_LOCK_STORAGE_KEY = 'profitstack_billing_lock';

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function consumeAuthHash() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get('access_token');
  if (!accessToken) return;

  const payload = decodeJwtPayload(accessToken);
  setAccessToken(accessToken);
  if (payload?.email) setCurrentUserEmail(payload.email);
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
}

consumeAuthHash();

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

export function setBillingLockState(payload) {
  localStorage.setItem(BILLING_LOCK_STORAGE_KEY, JSON.stringify(payload || {}));
}

export function getBillingLockState() {
  try {
    return JSON.parse(localStorage.getItem(BILLING_LOCK_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearBillingLockState() {
  localStorage.removeItem(BILLING_LOCK_STORAGE_KEY);
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
  const method = String(options.method || 'GET').toUpperCase();
  const adminOrg = new URLSearchParams(window.location.search).get('org');
  const requestUrl = new URL(`${API_BASE}${path}`, window.location.href);
  if (adminOrg && method === 'GET' && !requestUrl.searchParams.has('org')) {
    requestUrl.searchParams.set('org', adminOrg);
  }
  const headers = {
    ...(options.headers || {}),
    ...(email ? { 'X-User-Email': email } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const response = await fetch(requestUrl.toString(), { ...options, headers });
  if (response.status === 401) {
    clearCurrentUserEmail();
    redirectToUnauthorized('session-not-recognized');
    throw new Error('Unauthorized');
  }
  if (response.status === 402) {
    let payload = {};
    try {
      payload = await response.clone().json();
    } catch {
      payload = {};
    }
    if (payload?.reason === 'billing-action-required') {
      const lockMode = payload?.billing?.lockMode || 'none';
      if (lockMode === 'checkout_required') {
        window.location.href = './account.html?billing=required';
        throw new Error(payload.error || 'Billing checkout required');
      }
      setBillingLockState({
        reason: payload.reason,
        message: payload.error || 'Your billing needs attention before access can continue.',
        billing: payload.billing || null,
        capturedAt: new Date().toISOString(),
      });
      clearCurrentUserEmail();
      redirectToLogin('billing-required');
      throw new Error(payload.error || 'Billing action required');
    }
  }
  return response;
}
