type TokenBundle = {
  accessToken: string;
  refreshToken: string;
};

type SecureStoragePlugin = {
  get: (options: { key: string }) => Promise<{ value: string }>;
  set: (options: { key: string; value: string }) => Promise<void>;
  remove: (options: { key: string }) => Promise<void>;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    Plugins?: {
      SecureStoragePlugin?: SecureStoragePlugin;
    };
  };
};

const STORAGE_KEY = 'grid-auth-tokens';
let memoryTokens: TokenBundle | null = null;

function getSecureStoragePlugin(): SecureStoragePlugin | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as CapacitorWindow).Capacitor?.Plugins?.SecureStoragePlugin ?? null;
}

export async function saveAuthTokens(tokens: TokenBundle) {
  memoryTokens = tokens;
  const plugin = getSecureStoragePlugin();
  if (!plugin) {
    return;
  }

  await plugin.set({
    key: STORAGE_KEY,
    value: JSON.stringify(tokens),
  });
}

export async function readAuthTokens(): Promise<TokenBundle | null> {
  if (memoryTokens) {
    return memoryTokens;
  }

  const plugin = getSecureStoragePlugin();
  if (!plugin) {
    return null;
  }

  try {
    const item = await plugin.get({ key: STORAGE_KEY });
    memoryTokens = JSON.parse(item.value) as TokenBundle;
    return memoryTokens;
  } catch {
    return null;
  }
}

export async function clearAuthTokens() {
  memoryTokens = null;
  const plugin = getSecureStoragePlugin();
  if (!plugin) {
    return;
  }

  try {
    await plugin.remove({ key: STORAGE_KEY });
  } catch {
    return;
  }
}
