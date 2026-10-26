// This script can listen for messages from the web UI to save job details locally.
// Only the dashboard origin configured in the popup ("Meus dados") is trusted.
const DEFAULT_DASHBOARD_URL = 'http://localhost:3000';

window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "SET_ACTIVE_JOB") return;

  chrome.storage.sync.get({ dashboardUrl: DEFAULT_DASHBOARD_URL }, ({ dashboardUrl }) => {
    if (event.origin !== dashboardUrl) return;
    chrome.storage.local.set({ activeJob: event.data.payload }, () => {
      console.log("Job Copilot: Active job saved to extension storage.");
    });
  });
});
