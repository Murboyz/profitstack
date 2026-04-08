const reason = new URLSearchParams(window.location.search).get('reason');

const reasonMessages = {
  'session-not-recognized': 'Your saved The Nut Report session is no longer recognized.',
  unauthorized: 'You do not currently have access to this The Nut Report route.',
};

document.getElementById('message').textContent = reasonMessages[reason] || 'Your The Nut Report session needs attention before you can continue.';
