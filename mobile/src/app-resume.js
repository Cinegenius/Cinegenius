(function resumeCineGenius(origin) {
  'use strict';
  // Native lifecycle notification only: no account data, storage or API call.
  if (window.top !== window.self || window.location.origin !== origin) return;
  window.dispatchEvent(new Event('cinegenius:app-resume'));
})(null /* CINEGENIUS_RESUME_ORIGIN */);
