(function installCineGeniusVoice(configuration) {
  'use strict';
  if (!configuration || window.top !== window.self || location.origin !== configuration.origin
      || window.CineGeniusVoice || typeof crypto.randomUUID !== 'function') return;
  const ios = window.webkit?.messageHandlers?.cinegeniusVoice;
  const android = window.cinegeniusVoiceNative;
  if (typeof ios?.postMessage !== 'function' && typeof android?.postMessage !== 'function') return;
  const documentId = crypto.randomUUID(), pending = new Map();
  const locales = new Set(configuration.locales);
  const codes = new Set(['permission-denied', 'unavailable', 'language-unavailable', 'no-speech',
    'network', 'busy', 'cancelled', 'interrupted', 'audio', 'invalid-request', 'gesture-required', 'timeout']);
  const states = new Set(['requesting-permission', 'listening', 'processing', 'speaking', 'idle', 'error']);
  let listening = null, speaking = null, navigationWatch = null;
  const error = code => Object.assign(new Error(code), {code});
  const state = (requestId, value, extra = {}) => window.dispatchEvent(new CustomEvent('cinegenius:voice-state', {
    detail: {requestId, state: value, ...extra},
  }));
  function send(action, requestId, values = {}) {
    const message = {v: 1, documentId, requestId, action, ...values};
    if (ios) ios.postMessage(message); else android.postMessage(JSON.stringify(message));
  }
  function finish(requestId, code, result) {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId); clearTimeout(entry.timer);
    if (requestId === listening) listening = null;
    if (requestId === speaking) speaking = null;
    if (!pending.size && navigationWatch !== null) { clearInterval(navigationWatch); navigationWatch = null; }
    if (entry.action !== 'capabilities') state(requestId, code ? 'error' : 'idle', code ? {code} : {});
    if (code) entry.reject(error(code)); else entry.resolve(result);
  }
  function cancelOperation(requestId, action, code = 'cancelled') {
    if (!requestId) return;
    try { send(action, requestId); } catch { /* Detached transports still settle locally. */ }
    finally { finish(requestId, code); }
  }
  function interrupt() {
    for (const [id, entry] of [...pending]) {
      cancelOperation(id, entry.action === 'speak' ? 'stopSpeaking' : 'cancel', 'interrupted');
    }
  }
  function request(action, values) {
    if (document.visibilityState !== 'visible' || location.origin !== configuration.origin) return Promise.reject(error('interrupted'));
    if (!values || !locales.has(values.locale)) return Promise.reject(error('language-unavailable'));
    if (pending.size >= 8) return Promise.reject(error('busy'));
    if (action === 'start' && !navigator.userActivation?.isActive) return Promise.reject(error('gesture-required'));
    if (action === 'start' && listening) return Promise.reject(error('busy'));
    if (action === 'speak' && (typeof values.text !== 'string' || !values.text.trim() || values.text.length > 6000)) return Promise.reject(error('invalid-request'));
    if (action === 'start') cancelOperation(speaking, 'stopSpeaking');
    if (action === 'speak') { cancelOperation(listening, 'cancel'); cancelOperation(speaking, 'stopSpeaking'); }
    const requestId = crypto.randomUUID(), href = location.href;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cancelOperation(requestId, action === 'speak' ? 'stopSpeaking' : 'cancel', 'timeout'),
        action === 'capabilities' ? 10000 : action === 'start' ? 60000 : 120000);
      pending.set(requestId, {resolve, reject, timer, action, href});
      if (action === 'start') listening = requestId;
      if (action === 'speak') speaking = requestId;
      if (navigationWatch === null) navigationWatch = setInterval(() => {
        if ([...pending.values()].some(entry => entry.href !== location.href)) interrupt();
      }, 250);
      try { send(action, requestId, action === 'speak' ? {locale: values.locale, text: values.text} : {locale: values.locale}); }
      catch { finish(requestId, 'unavailable'); }
    });
  }
  function receive(message) {
    if (!message || message.v !== 1 || message.documentId !== documentId) return;
    const entry = pending.get(message.requestId);
    if (!entry) return;
    if (document.visibilityState !== 'visible' || location.href !== entry.href) { interrupt(); return; }
    if (message.type === 'state' && states.has(message.state)) {
      const extra = typeof message.partialText === 'string' ? {partialText: message.partialText.slice(0, 6000)} : {};
      state(message.requestId, message.state, extra);
    } else if (message.type === 'error') {
      finish(message.requestId, codes.has(message.code) ? message.code : 'unavailable');
    } else if (message.type === 'result') {
      if (entry.action === 'start') {
        const text = message.result?.text;
        finish(message.requestId, typeof text !== 'string' || text.length > 6000 ? 'invalid-request' : !text.trim() ? 'no-speech' : null, {text});
      } else if (entry.action === 'capabilities') {
        const result = message.result;
        if (!result || ['recognition', 'synthesis', 'systemServiceMayProcessAudio'].some(key => typeof result[key] !== 'boolean')) finish(message.requestId, 'invalid-request');
        else finish(message.requestId, null, result);
      } else finish(message.requestId, null);
    }
  }
  Object.defineProperty(window, '__cinegeniusVoiceReceive', {value: receive});
  if (android) android.onmessage = event => { try { receive(JSON.parse(event.data)); } catch { /* Ignore malformed native replies. */ } };
  Object.defineProperty(window, 'CineGeniusVoice', {value: Object.freeze({
    version: 1,
    capabilities: values => request('capabilities', values),
    start: values => request('start', values),
    stop: () => { if (listening) { try { send('stop', listening); } catch { finish(listening, 'unavailable'); } } },
    cancel: () => cancelOperation(listening, 'cancel'),
    speak: values => request('speak', values),
    stopSpeaking: () => cancelOperation(speaking, 'stopSpeaking'),
  })});
  window.addEventListener('pagehide', interrupt);
  window.addEventListener('popstate', interrupt);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') interrupt(); });
  window.dispatchEvent(new Event('cinegenius:voice-ready'));
})(null /* CINEGENIUS_VOICE_CONFIG */);
