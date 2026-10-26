// Profile data used to fill application forms. Stored in chrome.storage.sync (the user's
// own browser profile) instead of being hardcoded in this file.
const PROFILE_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'city', 'linkedin', 'github', 'portfolio'];
const DEFAULT_DASHBOARD_URL = 'http://localhost:3000';

const $ = (id) => document.getElementById(id);
const setStatus = (text, ok = true) => {
  $('status').textContent = text;
  $('status').style.color = ok ? '#0a7d32' : '#c0262d';
};

function showTab(name) {
  $('panel-fill').hidden = name !== 'fill';
  $('panel-profile').hidden = name !== 'profile';
  $('tab-fill').classList.toggle('active', name === 'fill');
  $('tab-profile').classList.toggle('active', name === 'profile');
  setStatus('');
}

$('tab-fill').addEventListener('click', () => showTab('fill'));
$('tab-profile').addEventListener('click', () => showTab('profile'));

chrome.storage.sync.get({ profile: {}, dashboardUrl: DEFAULT_DASHBOARD_URL }, ({ profile, dashboardUrl }) => {
  PROFILE_FIELDS.forEach((field) => ($(field).value = profile[field] || ''));
  $('dashboardUrl').value = dashboardUrl;
  if (!profile.email && !profile.firstName) showTab('profile');
});

$('saveProfile').addEventListener('click', () => {
  const profile = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, $(field).value.trim()]));
  let dashboardUrl = $('dashboardUrl').value.trim() || DEFAULT_DASHBOARD_URL;
  try {
    dashboardUrl = new URL(dashboardUrl).origin;
  } catch {
    setStatus('URL do painel inválida.', false);
    return;
  }
  chrome.storage.sync.set({ profile, dashboardUrl }, () => setStatus('Dados salvos.'));
});

$('fillForm').addEventListener('click', async () => {
  const { profile } = await chrome.storage.sync.get({ profile: {} });
  if (!Object.values(profile).some(Boolean)) {
    showTab('profile');
    setStatus('Preencha "Meus dados" antes de usar o auto-preenchimento.', false);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result: filled } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: autoFillForm,
    args: [profile],
  });
  setStatus(filled ? `${filled} campo(s) preenchido(s).` : 'Nenhum campo reconhecido nesta página.', Boolean(filled));
});

// Runs in the context of the job application page.
function autoFillForm(profile) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const rules = [
    [/first.?name|given.?name|^nome$|primeiro.?nome/, profile.firstName],
    [/last.?name|family.?name|surname|sobrenome/, profile.lastName],
    [/full.?name|nome.?completo|^name$/, fullName],
    [/e-?mail/, profile.email],
    [/phone|mobile|tel|celular|telefone/, profile.phone],
    [/city|cidade|location|localiza/, profile.city],
    [/linkedin/, profile.linkedin],
    [/github/, profile.github],
    [/portfolio|website|site|url/, profile.portfolio],
  ];

  const describe = (input) => {
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    return [input.name, input.id, input.placeholder, input.getAttribute('aria-label'), input.autocomplete, label?.textContent]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  };

  let filled = 0;
  document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio])').forEach((input) => {
    if (input.value) return; // never overwrite what the user typed
    const text = describe(input);
    const match = rules.find(([pattern, value]) => value && pattern.test(text));
    if (!match) return;
    input.value = match[1];
    // Let React/Vue-based forms notice the change.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    filled++;
  });
  return filled;
}
