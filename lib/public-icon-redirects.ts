export function getPublicIconRedirects() {
  return [
    { source: "/favicon.ico", destination: "/icon.svg", permanent: false },
    { source: "/apple-touch-icon.png", destination: "/apple-icon.png", permanent: false },
  ];
}
