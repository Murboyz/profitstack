const STATUS_URL = './runtime/profitstack-cron-status.json';
const FALLBACK_URL = './runtime/profitstack-cron-status.example.json';

function formatTime(value) {
  if (!value) return 'No update yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderHistory(items) {
  if (!items?.length) return '<div class="muted">No tracked runs yet.</div>';
  return items.map((item) => `
    <div class="row">
      <span>${item.status || 'UNKNOWN'}</span>
      <strong>${item.workingOn || 'Unknown task'}</strong>
      <span class="muted">${formatTime(item.updatedAt)}</span>
    </div>
  `).join('');
}

function render(data) {
  const status = data.status || 'NO-OP';
  const pill = document.getElementById('statusPill');
  pill.textContent = status;
  pill.className = `status-pill status-${status}`;

  document.getElementById('workingOn').textContent = data.workingOn || 'No task recorded';
  document.getElementById('updatedAt').textContent = `Last update: ${formatTime(data.updatedAt)}`;
  document.getElementById('jobName').textContent = data.jobName || 'ProfitStack autonomous build pass';
  document.getElementById('history').innerHTML = renderHistory(data.history || []);
  document.getElementById('raw').textContent = JSON.stringify(data, null, 2);
}

async function loadStatus() {
  let response = await fetch(`${STATUS_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    response = await fetch(`${FALLBACK_URL}?t=${Date.now()}`, { cache: 'no-store' });
  }
  if (!response.ok) throw new Error(`Status fetch failed with ${response.status}`);
  return response.json();
}

async function main() {
  try {
    const data = await loadStatus();
    render(data);
  } catch (error) {
    document.getElementById('history').innerHTML = `<div class="muted">${error.message}</div>`;
    document.getElementById('raw').textContent = error.message;
  }
}

document.getElementById('refreshBtn').addEventListener('click', main);
main();
