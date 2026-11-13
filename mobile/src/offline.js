import { resolveLocale } from './locale.js';

let renderVersion = 0;
async function render(saved) {
  const version = ++renderVersion;
  const locale = resolveLocale(saved, navigator.languages?.join(',') || navigator.language);
  try {
    // Only the selected local bundle is read, including when the network is down.
    const response = await fetch(`locales/${locale}.json`);
    if (!response.ok) return;
    const copy = await response.json();
    if (version !== renderVersion) return;
    for (const key of ['unavailableTitle', 'unavailableDescription', 'retry']) {
      document.getElementById(key).textContent = copy[key];
    }
    document.documentElement.lang = locale;
  } catch {
    // The initial HTML remains usable even if a local asset cannot be read.
  }
}

let savedLocale;
try {
  savedLocale = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith('cg_locale='))?.slice(10);
} catch { /* Some native error pages do not expose cookies. */ }
// Native hosts forward only the public language preference, never session cookies.
window.addEventListener('cinegenius:locale', event => { void render(event.detail); });
void render(window.cinegeniusSavedLocale ?? savedLocale);
document.getElementById('retry').addEventListener('click', event => {
  event.preventDefault();
  // Replace the failure page instead of accumulating artificial Back entries.
  window.location.replace(event.currentTarget.href);
});
