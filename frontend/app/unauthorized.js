const reason = new URLSearchParams(window.location.search).get('reason');

const reasonMessages = {
  'session-not-recognized': 'Your saved ProfitStack session is no longer recognized.',
  unauthorized: 'You do not currently have access to this ProfitStack route.',
};

document.getElementById('message').textContent = reasonMessages[reason] || 'Your ProfitStack session needs attention before you can continue.';
