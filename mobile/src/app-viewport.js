(function installAppViewport(configuration) {
  'use strict';
  // Bundled iOS presentation adapter, executed in an isolated WebKit world.
  // No account, cookie, storage or native-message access is needed.
  if (!configuration || window.top !== window.self
      || window.location.origin !== configuration.origin) return;

  function install() {
    if (!document.head) return false;
    if (!document.getElementById('cinegenius-app-viewport')) {
      const style = document.createElement('style');
      style.id = 'cinegenius-app-viewport';
      style.textContent = configuration.css;
      document.head.append(style);
    }
    return true;
  }
  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
})(null /* CINEGENIUS_VIEWPORT_CONFIG */);
