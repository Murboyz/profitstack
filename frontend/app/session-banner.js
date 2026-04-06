import { apiFetch } from './auth.js';

let sessionPromise;

async function loadSession() {
  if (!sessionPromise) {
    sessionPromise = apiFetch('/api/session').then(async (res) => {
      if (!res.ok) throw new Error(`/api/session failed with ${res.status}`);
      return res.json();
    });
  }
  return sessionPromise;
}

export async function renderSessionBanner(targetId = 'sessionBanner') {
  const target = document.getElementById(targetId);
  if (!target) return null;

  try {
    const session = await loadSession();
    target.innerHTML = `
      <div class="session-banner-label">Signed in as</div>
      <div class="session-banner-grid">
        <div>
          <div class="session-banner-value">${session.user.fullName || session.user.email}</div>
          <div class="session-banner-meta">${session.user.email}</div>
        </div>
        <div>
          <div class="session-banner-value">${session.organization.name}</div>
          <div class="session-banner-meta">${session.organization.slug} · ${session.organization.timezone} · ${session.user.role}</div>
        </div>
      </div>
    `;
    return session;
  } catch (error) {
    target.textContent = `Session unavailable: ${error.message}`;
    return null;
  }
}
