document.getElementById('fillForm').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Here we would ideally fetch the highly scored job from our Next.js API
  // or use the data injected into the storage by the Next.js UI
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: autoFillForm,
  });
});

function autoFillForm() {
  // This runs in the context of the job application page
  // A robust version would have mapped selectors. Here is a generic approach:
  const profile = {
    firstName: "Alan",
    lastName: "User",
    email: "alan@example.com",
    linkedin: "https://linkedin.com/in/alan",
    github: "https://github.com/alan"
  };

  // Attempt to find inputs by name or label
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    const name = input.name.toLowerCase();
    if (name.includes('first') && name.includes('name')) input.value = profile.firstName;
    else if (name.includes('last') && name.includes('name')) input.value = profile.lastName;
    else if (name.includes('email')) input.value = profile.email;
    else if (name.includes('linkedin')) input.value = profile.linkedin;
    else if (name.includes('github')) input.value = profile.github;
  });

  alert('Job Copilot: Form fields filled where possible!');
}

