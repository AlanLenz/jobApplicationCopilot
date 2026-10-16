// This script can listen for messages from the web UI to save job details locally
window.addEventListener("message", (event) => {
  // We only accept messages from our Next.js dashboard (e.g., localhost:3000)
  if (event.origin !== "http://localhost:3000") return;

  if (event.data && event.data.type === "SET_ACTIVE_JOB") {
    chrome.storage.local.set({ activeJob: event.data.payload }, () => {
      console.log("Job Copilot: Active job saved to extension storage.");
    });
  }
});

