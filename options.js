// Load saved options when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiKey', 'apiUrl'], (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
    if (result.apiUrl) {
      document.getElementById('apiUrl').value = result.apiUrl;
    }
  });
});

// Save options when the form is submitted
document.getElementById('options-form').addEventListener('submit', (event) => {
  event.preventDefault();

  const apiKey = document.getElementById('apiKey').value;
  const apiUrl = document.getElementById('apiUrl').value;

  chrome.storage.local.set({ apiKey, apiUrl }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved successfully!';
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  });
});

// Clear stored credentials when the "Clear" button is clicked
document.getElementById('clear-button').addEventListener('click', () => {
  chrome.storage.local.remove(['apiKey', 'apiUrl'], () => {
    document.getElementById('apiKey').value = '';
    document.getElementById('apiUrl').value = '';
    const status = document.getElementById('status');
    status.textContent = 'Credentials cleared successfully!';
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  });
});