/** This remote-content configuration is deliberately limited to development. */
export function previewConfig(input = 'https://www.cinegenius.co') {
  const url = new URL(input);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use an origin only, without credentials, path, query or fragment.');
  }
  const publicSite = url.origin === 'https://www.cinegenius.co';
  const loopback = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname)
    && url.protocol === 'http:' && Boolean(url.port);
  if (!publicSite && !loopback) {
    throw new Error('Preview supports the CineGenius HTTPS origin or an explicit local development port.');
  }
  return {
    appId: 'co.cinegenius.app.preview',
    appName: 'CineGenius Preview',
    webDir: 'www',
    backgroundColor: '#0A0A0A',
    loggingBehavior: 'none',
    zoomEnabled: true,
    includePlugins: [],
    server: {
      // The trailing slash also prevents prefix matches with lookalike hostnames.
      url: url.href,
      // The existing server page restores a valid session or shows the form.
      appStartPath: 'sign-in',
      cleartext: loopback,
      errorPath: 'offline.html',
      allowNavigation: [],
    },
    ios: { contentInset: 'automatic', preferredContentMode: 'mobile' },
    android: { allowMixedContent: false },
    plugins: {
      CapacitorHttp: { enabled: false },
      CapacitorCookies: { enabled: false },
    },
  };
}
