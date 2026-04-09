function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function resolveConfiguredBase() {
  const rawValue = import.meta.env.VITE_API_BASE_URL?.trim();
  const browserHostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  const browserIsLocal = isLocalHostname(browserHostname);

  if (rawValue) {
    if (rawValue.startsWith('/')) {
      return trimTrailingSlash(rawValue);
    }

    try {
      const parsed = new URL(rawValue);
      const configIsLocal = isLocalHostname(parsed.hostname);

      // If we are on a PUBLIC domain, and the config says LOCALHOST,
      // we MUST ignore the config and use relative paths instead.
      // Otherwise, the browser will block the request (Mixed Content).
      if (!browserIsLocal && configIsLocal) {
        return '/api';
      }

      return trimTrailingSlash(parsed.toString());
    } catch {
      return trimTrailingSlash(rawValue);
    }
  }

  return browserIsLocal ? 'http://localhost:8000/api' : 'https://grid-yf8m.onrender.com/api';
}

export const API_BASE_URL = resolveConfiguredBase();
