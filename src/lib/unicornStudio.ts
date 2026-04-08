const UNICORN_STUDIO_SRC =
  'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.3/dist/unicornStudio.umd.js';

type UnicornStudioWindow = Window & {
  UnicornStudio?: {
    init: () => void;
  };
};

let unicornStudioLoader: Promise<void> | null = null;
let unicornStudioInitQueued = false;

function queueUnicornStudioInit() {
  if (typeof window === 'undefined' || unicornStudioInitQueued) {
    return;
  }

  unicornStudioInitQueued = true;
  window.requestAnimationFrame(() => {
    unicornStudioInitQueued = false;
    (window as UnicornStudioWindow).UnicornStudio?.init();
  });
}

function createLoaderPromise(script: HTMLScriptElement) {
  unicornStudioLoader = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const handleLoad = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      unicornStudioLoader = null;
      reject(new Error('Failed to load Unicorn Studio.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
  });

  return unicornStudioLoader;
}

export function initUnicornStudioBackground() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  const unicornWindow = window as UnicornStudioWindow;
  if (unicornWindow.UnicornStudio) {
    queueUnicornStudioInit();
    return Promise.resolve();
  }

  if (!unicornStudioLoader) {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-unicorn-studio="true"]');

    if (existingScript) {
      unicornStudioLoader = createLoaderPromise(existingScript);
    } else {
      const script = document.createElement('script');
      script.src = UNICORN_STUDIO_SRC;
      script.async = true;
      script.dataset.unicornStudio = 'true';
      document.body.appendChild(script);
      unicornStudioLoader = createLoaderPromise(script);
    }
  }

  return unicornStudioLoader
    .then(() => {
      queueUnicornStudioInit();
    })
    .catch(() => {
      // Keep the app usable even when the decorative background library fails to load.
    });
}
