import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

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
  } catch (error) {
    app.textContent = `Failed to load account data: ${error.message}`;
  }
}

main();
