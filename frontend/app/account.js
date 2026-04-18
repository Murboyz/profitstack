import { apiFetch, requireLogin, getAccessToken } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

const billingMessages = {
  success: 'Checkout completed. Your billing should show as active as soon as Stripe finishes provisioning.',
  cancelled: 'Checkout was cancelled. You can come back and finish billing anytime.',
  updated: 'Stripe billing update completed. Sign back in and confirm your account is active.',
  required: 'Payment is required before dashboard access can continue. Complete checkout below.',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(amount, currency = 'USD') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'USD').toUpperCase() }).format(Number(amount));
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function billingBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (['active', 'trialing'].includes(normalized)) return '<span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(140,240,196,.14);border:1px solid rgba(140,240,196,.28);color:#8cf0c4;font-weight:800;text-transform:uppercase;font-size:12px;">Active / Paid</span>';
  if (['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(normalized)) return '<span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(255,154,172,.14);border:1px solid rgba(255,154,172,.28);color:#ff9aac;font-weight:800;text-transform:uppercase;font-size:12px;">Payment failed</span>';
  if (['customer_only', 'not_found'].includes(normalized)) return '<span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(249,221,141,.12);border:1px solid rgba(249,221,141,.24);color:#f9dd8d;font-weight:800;text-transform:uppercase;font-size:12px;">Not paid yet</span>';
  return `<span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#eef4ff;font-weight:800;text-transform:uppercase;font-size:12px;">${escapeHtml(String(status || 'unknown').replaceAll('_', ' '))}</span>`;
}

function checkoutButtonLabel(billing) {
  if (billing.needsCheckout) return 'Complete subscription payment';
  return 'Start subscription checkout';
}

async function getFrontendConfig() {
  const res = await fetch('/api/frontend-config');
  if (!res.ok) throw new Error(`Frontend config failed with ${res.status}`);
  return res.json();
}

async function main() {
  const app = document.getElementById('app');
  try {
    await renderSessionBanner();
    const accountRes = await apiFetch('/api/account');
    const account = await accountRes.json();
    const { organization: org, user, billing } = account;
    const billingState = new URLSearchParams(window.location.search).get('billing');
    const setupState = new URLSearchParams(window.location.search).get('setup');
    const payment = billing.lastPayment || null;
    const showCheckoutButton = billing.checkoutReady && !billing.paid;
    const showUpdateButton = Boolean(billing.updatePaymentUrl) && (billing.needsAttention || billing.cancelAtPeriodEnd || billing.customerId);
    const paymentRequiredPanel = (billing.needsAttention || billing.needsCheckout) ? `
      <div class="panel" style="border-color: rgba(255,154,172,.24); background: rgba(255,154,172,.08);">
        <h2 style="margin-top:0;">${billing.needsCheckout ? 'Payment required' : 'Payment issue'}</h2>
        <p>${billing.needsCheckout
          ? 'This account has not paid yet. Complete checkout below before dashboard access can continue.'
          : 'Your card needs attention before dashboard access can continue. Update payment in Stripe, then sign back in after Stripe confirms the change.'}</p>
        ${showCheckoutButton ? `<button id="startBillingButton" type="button" ${billing.checkoutReady ? '' : 'disabled'}>${billing.checkoutReady ? checkoutButtonLabel(billing) : 'Billing unavailable'}</button>` : ''}
        ${showUpdateButton ? '<button id="updateBillingButton" type="button">Update payment in Stripe</button>' : ''}
        <div id="billingInlineResult">${billingState ? (billingMessages[billingState] || '') : ''}</div>
      </div>
    ` : '';
    app.innerHTML = `
      ${user.role === 'admin' && org.slug === 'the-nut-report-admin' ? `
        <div class="panel">
          <h2>Admin</h2>
          <p>This is your internal admin account.</p>
          <p><a href="./admin.html">Return to admin panel</a></p>
        </div>
      ` : ''}
      ${setupState === 'dashboard-setup' ? `
        <div class="panel">
          <h2>Setup in progress</h2>
          <p>Your billing is done. If your login works, continue into CRM connection and dashboard setup.</p>
          <p><a href="./connect-crm.html?next=dashboard-setup">Continue setup</a></p>
        </div>
      ` : ''}
      ${paymentRequiredPanel}
      <div class="panel">
        <h2>Organization</h2>
        <p><strong>Name:</strong> ${org.name}</p>
        <p><strong>Timezone:</strong> ${org.timezone}</p>
        <p><strong>Status:</strong> ${org.status}</p>
      </div>
      <div class="panel">
        <h2>User</h2>
        <p><strong>Name:</strong> ${user.full_name || user.fullName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Role:</strong> ${user.role}</p>
      </div>
      <div class="panel">
        <h2>Billing</h2>
        <p><strong>Plan:</strong> ${billing.planName}</p>
        <p><strong>Price:</strong> ${billing.priceDisplay}</p>
        <p><strong>Status:</strong> ${billingBadge(billing.subscriptionStatus)}</p>
        <p><strong>Checkout Email:</strong> ${billing.customerEmail || user.email}</p>
        <p><strong>Renewal / period end:</strong> ${escapeHtml(formatDateTime(billing.currentPeriodEnd))}</p>
        <p><strong>Last payment:</strong> ${escapeHtml(formatMoney(payment?.amount, payment?.currency))}</p>
        <p><strong>Last payment date:</strong> ${escapeHtml(formatDateTime(payment?.paidAt))}</p>
        <p><strong>Last payment status:</strong> ${escapeHtml(payment?.status || billing.latestInvoiceStatus || '—')}</p>
        <p><strong>Billing Support:</strong> ${billing.supportEmail}</p>
        <div style="margin-top:16px; text-align:right;">
          <a
            href="mailto:chad@stopworkingbroke.com?subject=${encodeURIComponent('Cancel The Nut Report subscription')}&body=${encodeURIComponent(`Please cancel my The Nut Report subscription.\n\nOrganization: ${org.name}\nEmail: ${user.email}\n`)}"
            style="font-size:12px; color:#ffd5d5; text-decoration:none; border:1px solid rgba(239,68,68,.45); border-radius:999px; padding:7px 11px; display:inline-block; background: rgba(239,68,68,.12);"
          >Cancel subscription</a>
        </div>
      </div>
    `;

    document.getElementById('startBillingButton')?.addEventListener('click', async () => {
      const button = document.getElementById('startBillingButton');
      const inlineResult = document.getElementById('billingInlineResult');
      button.disabled = true;
      button.textContent = 'Opening Stripe checkout…';
      inlineResult.textContent = '';
      try {
        const res = await apiFetch('/api/billing/checkout-session', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed with ${res.status}`);
        window.location.href = data.url;
      } catch (error) {
        inlineResult.textContent = `Billing checkout failed: ${error.message}`;
        button.disabled = false;
        button.textContent = checkoutButtonLabel(billing);
      }
    });

    document.getElementById('updateBillingButton')?.addEventListener('click', async () => {
      const button = document.getElementById('updateBillingButton');
      const inlineResult = document.getElementById('billingInlineResult');
      button.disabled = true;
      button.textContent = 'Opening Stripe…';
      inlineResult.textContent = '';
      try {
        if (billing.updatePaymentUrl) {
          window.location.href = billing.updatePaymentUrl;
          return;
        }
        const res = await apiFetch('/api/billing/portal-session', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || `Billing portal failed with ${res.status}`);
        window.location.href = data.url;
      } catch (error) {
        inlineResult.textContent = `Could not open Stripe billing update: ${error.message}`;
        button.disabled = false;
        button.textContent = 'Update payment in Stripe';
      }
    });

    document.getElementById('passwordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = document.getElementById('passwordResult');
      try {
        const { supabaseUrl, supabaseAnonKey } = await getFrontendConfig();
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ password: document.getElementById('newPassword').value }),
        });
        if (!res.ok) throw new Error(`Password save failed with ${res.status}`);
        result.textContent = 'Password saved.';
      } catch (error) {
        result.textContent = `Password update failed: ${error.message}`;
      }
    });
  } catch (error) {
    app.textContent = `Failed to load account data: ${error.message}`;
  }
}

main();
