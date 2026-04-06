async function main() {
  const app = document.getElementById('app');
  try {
    const res = await fetch('/api/status');
    const text = await res.text();

    const lines = text.split(/\r?\n/);
    const data = {
      progress: 'Unknown',
      stage: 'Unknown',
      current: [],
      completed: [],
      blocked: [],
      remaining: [],
    };

    let section = null;
    for (const line of lines) {
      if (line.startsWith('Progress:')) data.progress = line.replace('Progress:', '').trim();
      else if (line.startsWith('Stage:')) data.stage = line.replace('Stage:', '').trim();
      else if (line.startsWith('Current:')) section = 'current';
      else if (line.startsWith('Last completed:')) section = 'completed';
      else if (line.startsWith('Blocked:')) section = 'blocked';
      else if (line.startsWith('Remaining major tasks:')) section = 'remaining';
      else if (line.startsWith('- ')) data[section]?.push(line.slice(2));
    }

    const list = (items) => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '<p>None</p>';

    app.innerHTML = `
      <div style="font-size:48px;font-weight:800;margin-bottom:8px;">${data.progress}</div>
      <div style="color:#94a3c7;margin-bottom:20px;">${data.stage}</div>
      <h2>Current</h2>
      ${list(data.current)}
      <h2>Last Completed</h2>
      ${list(data.completed)}
      <h2>Blocked</h2>
      ${list(data.blocked)}
      <h2>Remaining Major Tasks</h2>
      ${list(data.remaining)}
    `;
  } catch (error) {
    app.textContent = `Failed to load status: ${error.message}`;
  }
}

main();
