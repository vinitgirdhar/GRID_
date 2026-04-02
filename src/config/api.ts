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

      if (!(configIsLocal && !browserIsLocal)) {
        return trimTrailingSlash(parsed.toString());
      }
    } catch {
      return trimTrailingSlash(rawValue);
    }
  }

  return browserIsLocal ? 'http://localhost:8000/api' : '/api';
}

export const API_BASE_URL = resolveConfiguredBase();
