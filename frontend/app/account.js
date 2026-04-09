import { apiFetch, requireLogin, getAccessToken } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

async function getFrontendConfig() {
  const res = await fetch('/api/frontend-config');
  if (!res.ok) throw new Error(`Frontend config failed with ${res.status}`);
  return res.json();
}

async function main() {
  const app = document.getElementById('app');
  try {
    await renderSessionBanner();
    const [orgRes, userRes] = await Promise.all([
      apiFetch('/api/organizations/me'),
      apiFetch('/api/users/me')
    ]);
    const org = await orgRes.json();
    const user = await userRes.json();
    app.innerHTML = `
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
    `;

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
