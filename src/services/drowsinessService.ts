import { DrowsinessResponse, DrowsinessUpdatePayload } from '../types';

export const VISION_BUNDLE_PATH = 'mediapipe/vision_bundle.mjs';
export const VISION_WASM_PATH = 'mediapipe/wasm';
export const FACE_LANDMARKER_MODEL_PATH = 'mediapipe/face_landmarker.task';

export const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const;
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const;
export const EYE_RING = [0, 1, 2, 3, 4, 5, 0] as const;
export const MOUTH = [78, 81, 13, 311, 308, 402, 14, 178, 78] as const;
export const DEFAULT_THRESHOLD = 0.23;
export const YAWN_THRESHOLD = 0.5;
export const JAW_OPEN_THRESHOLD = 0.7;
export const YAWN_SUSTAINED_SECONDS = 1.5;
export const CLOSED_FRAME_THRESHOLD = 20;
export const CLOSED_SECONDS_THRESHOLD = 2;
export const POST_INTERVAL_MS = 900;
export const BUZZ_INTERVAL_MS = 1100;

export type Landmark = { x: number; y: number; z?: number };
export type BlendshapeCategory = { categoryName: string; score: number };
export type FaceLandmarkerResult = {
  faceLandmarks?: Landmark[][];
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};
export type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
  close?: () => void;
};
type VisionBundleModule = {
  FilesetResolver: { forVisionTasks: (wasmRoot: string) => Promise<unknown> };
  FaceLandmarker: {
    createFromOptions: (
      vision: unknown,
      options: Record<string, unknown>,
    ) => Promise<FaceLandmarkerInstance>;
  };
};

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function computeEar(points: { x: number; y: number }[]) {
  const verticalOne = distance(points[1], points[5]);
  const verticalTwo = distance(points[2], points[4]);
  const horizontal = distance(points[0], points[3]);
  if (!horizontal) {
    return 0;
  }
  return (verticalOne + verticalTwo) / (2 * horizontal);
}

export function computeMouthRatio(points: { x: number; y: number }[]) {
  const vertical = distance(points[2], points[6]);
  const horizontal = distance(points[0], points[4]);
  if (!horizontal) {
    return 0;
  }
  return vertical / horizontal;
}

export function blendshapeScore(result: FaceLandmarkerResult | null, name: string) {
  const categories = result?.faceBlendshapes?.[0]?.categories;
  if (!categories) {
    return 0;
  }
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}

export function buildDrowsinessPayload(
  next: Partial<DrowsinessResponse> & Pick<DrowsinessUpdatePayload, 'status' | 'severity'>,
): DrowsinessUpdatePayload {
  return {
    status: next.status,
    severity: next.severity,
    ear: next.ear ?? null,
    threshold: next.threshold ?? DEFAULT_THRESHOLD,
    consecutive_closed_frames: next.consecutive_closed_frames ?? 0,
    eyes_closed_seconds: next.eyes_closed_seconds ?? 0,
    alarm_active: next.alarm_active ?? false,
    assistant_response: next.assistant_response ?? null,
    source: next.source ?? 'android-camera',
    updated_at: new Date().toISOString(),
  };
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function formatLogTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function resolvePublicAsset(path: string) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  return new URL(`${normalizedBase}${normalizedPath}`, window.location.origin).toString();
}

export async function requestCameraStream(setLoadingStep: (value: string) => void) {
  const attempts: Array<{ step: string; constraints: MediaStreamConstraints }> = [
    {
      step: 'Requesting camera (Primary: HD)...',
      constraints: {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      },
    },
    {
      step: 'Retrying camera (Basic)...',
      constraints: {
        video: true,
        audio: false,
      },
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      setLoadingStep(attempt.step);
      return await withTimeout(
        navigator.mediaDevices.getUserMedia(attempt.constraints),
        10000,
        `Timed out at step: ${attempt.step}`,
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to open the webcam after multiple attempts.');
}

export function waitForVideoMetadata(video: HTMLVideoElement, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1 || video.videoWidth > 0) {
      resolve();
      return;
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('loadeddata', onLoadedMetadata);
      video.removeEventListener('error', onVideoError);
    };

    const onLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const onVideoError = () => {
      cleanup();
      reject(new Error('The webcam stream opened but the video element failed to load it.'));
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('The webcam stream opened, but video frames never started.'));
    }, timeoutMs);

    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('loadeddata', onLoadedMetadata, { once: true });
    video.addEventListener('error', onVideoError, { once: true });
  });
}

export async function createFaceLandmarker() {
  const visionBundleUrl = resolvePublicAsset(VISION_BUNDLE_PATH);
  const visionWasmUrl = resolvePublicAsset(VISION_WASM_PATH);
  const faceLandmarkerModelUrl = resolvePublicAsset(FACE_LANDMARKER_MODEL_PATH);

  const vision = (await withTimeout(
    import(/* @vite-ignore */ visionBundleUrl),
    20000,
    'Face mesh bundle did not load. Confirm the local MediaPipe assets are present in /public/mediapipe.',
  )) as VisionBundleModule;

  const visionFiles = await withTimeout(
    vision.FilesetResolver.forVisionTasks(visionWasmUrl),
    20000,
    'Face mesh runtime did not initialize.',
  );

  return withTimeout(
    vision.FaceLandmarker.createFromOptions(visionFiles, {
      baseOptions: { modelAssetPath: faceLandmarkerModelUrl },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      minFaceDetectionConfidence: 0.25,
      minFacePresenceConfidence: 0.25,
      minTrackingConfidence: 0.25,
      numFaces: 1,
    }),
    25000,
    'Face mesh model did not load from local assets.',
  );
}
