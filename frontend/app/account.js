import { apiFetch, requireLogin, getAccessToken } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

const billingMessages = {
  success: 'Checkout completed. Once Stripe finishes provisioning, billing will show up on your account.',
  cancelled: 'Checkout was cancelled. You can come back and finish billing anytime.',
};

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
    app.innerHTML = `
      ${setupState === 'dashboard-setup' ? `
        <div class="panel">
          <h2>Setup in progress</h2>
          <p>Your billing is done. If your login works, continue into CRM connection and dashboard setup.</p>
          <p><a href="./connect-crm.html?next=dashboard-setup">Continue setup</a></p>
        </div>
      ` : ''}
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
        <p><strong>Status:</strong> ${billing.configured ? 'Ready for checkout' : 'Not configured yet'}</p>
        <p><strong>Checkout Email:</strong> ${billing.customerEmail || user.email}</p>
        <p><strong>Billing Support:</strong> ${billing.supportEmail}</p>
        <button id="startBillingButton" type="button" ${billing.checkoutReady ? '' : 'disabled'}>
          ${billing.checkoutReady ? 'Start subscription checkout' : 'Billing unavailable'}
        </button>
        <div id="billingInlineResult">${billingState ? (billingMessages[billingState] || '') : ''}</div>
        <div style="margin-top:16px; text-align:right;">
          <a
            href="mailto:${encodeURIComponent(billing.supportEmail)}?subject=${encodeURIComponent('Cancel The Nut Report subscription')}&body=${encodeURIComponent(`Please cancel my The Nut Report subscription.\n\nOrganization: ${org.name}\nEmail: ${user.email}\n`)}"
            style="font-size:12px; color:#94a3c7; text-decoration:none; border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:6px 10px; display:inline-block;"
          >Request cancellation</a>
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
        button.textContent = 'Start subscription checkout';
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
