import {
  setCurrentUserEmail,
  getCurrentUserEmail,
  clearCurrentUserEmail,
  setAccessToken,
  setBillingLockState,
  getBillingLockState,
  clearBillingLockState,
} from './auth.js';

const reasonMessages = {
  'missing-session': 'Sign in to continue.',
  'session-not-recognized': 'That session is no longer valid. Choose an approved user and sign in again.',
  'login-required': 'Sign in to continue.',
  'billing-required': 'Your card needs attention before account access can continue.',
};

const billingMessages = {
  updated: 'Billing update received. Sign in again to continue.',
  required: 'Billing is required before dashboard access can continue.',
};

const reason = new URLSearchParams(window.location.search).get('reason');
const billingState = new URLSearchParams(window.location.search).get('billing');
if (reason) {
  document.getElementById('result').textContent = reasonMessages[reason] || 'Sign in to continue.';
} else if (billingState) {
  if (billingState === 'updated') clearBillingLockState();
  document.getElementById('result').textContent = billingMessages[billingState] || '';
}

function showBillingRequiredModal(lockState) {
  if (!lockState?.billing) return;

  const existing = document.getElementById('billingLockModal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'billingLockModal';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(6,10,18,.78);display:flex;align-items:center;justify-content:center;padding:20px;z-index:9999;';

  const card = document.createElement('div');
  card.style.cssText = 'width:min(520px,100%);background:#0f1728;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.38);';
  const billing = lockState.billing || {};
  const payment = billing.lastPayment || null;
  card.innerHTML = `
    <h2 style="margin:0 0 10px;">Update billing to get back in</h2>
    <p style="color:#94a3c7;line-height:1.5;">${lockState.message || 'Your card needs attention before access can continue.'}</p>
    <div style="margin:14px 0;padding:14px;border-radius:14px;background:#111a2e;border:1px solid rgba(255,255,255,.08);">
      <div style="margin-bottom:8px;"><strong>Status:</strong> ${billing.statusLabel || billing.subscriptionStatus || 'unknown'}</div>
      <div style="margin-bottom:8px;"><strong>Plan:</strong> ${billing.planName || 'The Nut Report'} (${billing.priceDisplay || ''})</div>
      <div><strong>Last payment:</strong> ${payment ? `${payment.amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency || 'USD' }).format(Number(payment.amount || 0)) : '—'} · ${payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'date unavailable'} · ${payment.status || 'status unavailable'}` : 'No recent payment found'}</div>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <button id="billingUpdateButton" type="button" style="flex:1;padding:12px;border-radius:12px;border:0;background:linear-gradient(180deg,#6a97ff 0%,#4b7ef4 100%);color:#fff;font-weight:800;cursor:pointer;">Update payment in Stripe</button>
      <button id="billingDismissButton" type="button" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:#111a2e;color:#eef4ff;font-weight:700;cursor:pointer;">Stay signed out</button>
    </div>
  `;
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const updateButton = document.getElementById('billingUpdateButton');
  const dismissButton = document.getElementById('billingDismissButton');
  updateButton?.addEventListener('click', () => {
    if (billing.updatePaymentUrl) {
      window.location.href = billing.updatePaymentUrl;
      return;
    }
    document.getElementById('result').textContent = 'Billing update link is not ready yet. Contact support if this keeps happening.';
  });
  dismissButton?.addEventListener('click', () => {
    clearCurrentUserEmail();
    backdrop.remove();
  });
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
      if (session?.billing?.accessBlocked) {
        if (session?.billing?.lockMode === 'checkout_required') {
          return './account.html?billing=required';
        }
        setBillingLockState({
          reason: 'billing-action-required',
          message: 'Your card needs attention before account access can continue.',
          billing: session.billing,
          capturedAt: new Date().toISOString(),
        });
        clearCurrentUserEmail();
        return './login.html?reason=billing-required';
      }
      if (session?.user?.role === 'admin' && session?.organization?.slug === 'the-nut-report-admin') {
        clearBillingLockState();
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
    clearBillingLockState();
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

const existingBillingLock = getBillingLockState();
if (reason === 'billing-required' && existingBillingLock) {
  clearCurrentUserEmail();
  showBillingRequiredModal(existingBillingLock);
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
