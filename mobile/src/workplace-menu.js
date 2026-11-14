(function installCineGeniusWorkplace(configuration) {
  'use strict';
  if (!configuration || window.top !== window.self
      || !configuration.allowedOrigins.includes(window.location.origin)
      || typeof window.webkit?.messageHandlers?.cinegeniusWorkplace?.postMessage !== 'function'
      || window.__cinegeniusWorkplaceInstalled) return;
  window.__cinegeniusWorkplaceInstalled = true;

  const registered = new WeakSet();
  // Recognition-only tokens from the previously shipped nav.ai labels. The
  // reviewed Work rename is not live yet; never render these legacy tokens.
  const previousToolsLabels = new Set(['KI', 'AI', 'IA', 'MI']);
  const supported = Object.keys(configuration.locales);
  const resolveLocale = () => {
    const tag = document.documentElement.lang.trim().replaceAll('_', '-').toLowerCase();
    return supported.find(locale => locale.toLowerCase() === tag)
      || supported.find(locale => locale === tag.split('-')[0])
      || configuration.defaultLocale;
  };
  function updateMenu() {
    const menu = document.getElementById('site-navigation-menu');
    // Opening this dialog requires the site's hydrated React click handler.
    // Never alter server HTML before hydration, including a hidden menu.
    if (!menu?.open) return;
    const copy = configuration.locales[resolveLocale()];
    for (const button of menu.querySelectorAll('nav button[disabled], nav button[data-cg-native-workplace]')) {
      const spans = button.querySelectorAll('span > span');
      if (spans.length !== 2) continue;
      const [label, detail] = spans;
      const isLegacyEntry = Object.values(configuration.locales).some(candidate =>
        (label.textContent === candidate.legacyLabel || previousToolsLabels.has(label.textContent))
          && detail.textContent === candidate.legacyBadge);
      if (!registered.has(button) && !isLegacyEntry) continue;
      if (!registered.has(button)) {
        registered.add(button);
        button.dataset.cgNativeWorkplace = '';
        button.classList.remove('cursor-default');
        button.classList.remove('text-text-muted');
        button.classList.add('text-text-secondary', 'focus-visible:outline-2', 'focus-visible:outline-gold');
        button.addEventListener('click', event => {
          if (!event.isTrusted) return;
          const bridge = window.webkit?.messageHandlers?.cinegeniusWorkplace;
          if (typeof bridge?.postMessage !== 'function') return;
          event.preventDefault();
          event.stopImmediatePropagation();
          // Opening a native screen sends no account, camera or plan data to the page.
          bridge.postMessage({ action: 'openWorkplace', locale: resolveLocale() });
          // React's existing close handler restores scrolling and its menu state.
          menu.close();
        }, true);
      }
      if (button.disabled) button.disabled = false;
      if (label.textContent !== copy.title) label.textContent = copy.title;
      if (detail.textContent !== copy.description) detail.textContent = copy.description;
      if (button.getAttribute('aria-label') !== copy.title) button.setAttribute('aria-label', copy.title);
    }
  }

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; updateMenu(); });
  }
  // The live development shell owns this dialog. Do not rewrite any other UI.
  new MutationObserver(records => {
    if (records.some(record => {
      const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      return element?.closest?.('#site-navigation-menu')
        || [...record.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE
          && (node.id === 'site-navigation-menu' || node.querySelector?.('#site-navigation-menu')));
    })) scheduleUpdate();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open'] });
  new MutationObserver(scheduleUpdate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  updateMenu();
})(null /* CINEGENIUS_WORKPLACE_CONFIG */);
