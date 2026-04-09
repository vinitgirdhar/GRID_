/**
 * mediapipePreloader.ts — Eagerly loads the MediaPipe WASM runtime and
 * face landmarker model in the background so the camera boots instantly.
 *
 * Call `startMediaPipePreload()` once at app startup (fire-and-forget).
 * When the camera component mounts, it calls `getPreloadedFaceLandmarker()`
 * which resolves immediately if preloading is done, or awaits the in-flight
 * promise otherwise.
 */

const VISION_WASM_URL = '/mediapipe-wasm';
const FACE_LANDMARKER_MODEL_URL = '/mediapipe-models/face_landmarker.task';

type Landmark = { x: number; y: number; z?: number };
type BlendshapeCategory = { categoryName: string; score: number };
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

let preloadPromise: Promise<FaceLandmarkerInstance> | null = null;

/**
 * Kicks off the full MediaPipe initialization pipeline in the background.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startMediaPipePreload(): void {
  if (preloadPromise) return;
  preloadPromise = doPreload();
}

async function doPreload(): Promise<FaceLandmarkerInstance> {
  const vision = (await import('@mediapipe/tasks-vision')) as VisionBundleModule;

  const visionFiles = await vision.FilesetResolver.forVisionTasks(VISION_WASM_URL);

  const faceLandmarker = await vision.FaceLandmarker.createFromOptions(visionFiles, {
    baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    runningMode: 'VIDEO',
    minFaceDetectionConfidence: 0.25,
    minFacePresenceConfidence: 0.25,
    minTrackingConfidence: 0.25,
    numFaces: 1,
  });

  return faceLandmarker;
}

/**
 * Returns the preloaded FaceLandmarker instance.
 * If preloading hasn't started, starts it now.
 * If preloading is in progress, awaits its completion.
 */
export function getPreloadedFaceLandmarker(): Promise<FaceLandmarkerInstance> {
  if (!preloadPromise) {
    startMediaPipePreload();
  }
  return preloadPromise!;
}
