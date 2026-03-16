import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '../lib/utils';
import { postDrowsinessStatus } from '../services/apiService';
import { DrowsinessResponse, DrowsinessSeverity, DrowsinessUpdatePayload } from '../types';


const VISION_BUNDLE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs';
const VISION_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const;
const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const;
const EYE_RING = [0, 1, 2, 3, 4, 5, 0] as const;
const DEFAULT_THRESHOLD = 0.23;
const CLOSED_FRAME_THRESHOLD = 20;
const CLOSED_SECONDS_THRESHOLD = 2;
const POST_INTERVAL_MS = 900;
const BUZZ_INTERVAL_MS = 1100;
const CAMERA_START_TIMEOUT_MS = 12000;
const FACE_MESH_LOAD_TIMEOUT_MS = 15000;

type Landmark = { x: number; y: number; z?: number };
type FaceLandmarkerResult = { faceLandmarks?: Landmark[][] };
type FaceLandmarkerInstance = {
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


function computeEar(points: { x: number; y: number }[]) {
  const verticalOne = distance(points[1], points[5]);
  const verticalTwo = distance(points[2], points[4]);
  const horizontal = distance(points[0], points[3]);
  if (!horizontal) {
    return 0;
  }
  return (verticalOne + verticalTwo) / (2 * horizontal);
}


function severityClasses(severity: DrowsinessSeverity) {
  if (severity === 'critical') {
    return {
      badge: 'bg-[var(--danger)] text-white',
      border: 'border-[var(--danger)]/30',
      accent: 'text-[var(--danger)]',
      glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.2)]',
    };
  }

  if (severity === 'warning') {
    return {
      badge: 'bg-sky-500 text-white',
      border: 'border-sky-500/30',
      accent: 'text-sky-600',
      glow: 'shadow-[0_0_0_1px_rgba(14,165,233,0.2)]',
    };
  }

  return {
    badge: 'bg-[var(--success)] text-white',
    border: 'border-[var(--success)]/30',
    accent: 'text-[var(--success)]',
    glow: 'shadow-[0_0_0_1px_rgba(34,197,94,0.18)]',
  };
}


function drawEyePath(
  context: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
) {
  context.beginPath();
  EYE_RING.forEach((index, position) => {
    const point = points[index];
    if (position === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
}


function buildPayload(
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
    source: next.source ?? 'browser-camera',
    updated_at: new Date().toISOString(),
  };
}


function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
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


export default function LiveDrowsinessCamera({ isLive }: { isLive: boolean }) {
  const [cameraState, setCameraState] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [status, setStatus] = useState<DrowsinessResponse>({
    status: 'Open camera to start live tracking',
    severity: 'warning',
    ear: null,
    threshold: DEFAULT_THRESHOLD,
    consecutive_closed_frames: 0,
    eyes_closed_seconds: 0,
    alarm_active: false,
    assistant_response: null,
    source: 'browser-camera',
    updated_at: new Date().toISOString(),
  });
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const closedSinceRef = useRef<number | null>(null);
  const consecutiveClosedFramesRef = useRef(0);
  const lastPostedSignatureRef = useRef<string>('');
  const lastPostedAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBuzzAtRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      faceLandmarkerRef.current?.close?.();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!isLive && cameraState === 'active') {
      void stopCamera();
    }
    if (!isLive) {
      setStatus((current) => ({
        ...current,
        status: 'Go live to enable the camera detector',
        severity: 'warning',
        alarm_active: false,
        assistant_response: null,
        updated_at: new Date().toISOString(),
      }));
    }
  }, [cameraState, isLive]);

  async function ensureAudioContext() {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }

    audioContextRef.current = new AudioCtor();
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }

  async function buzz() {
    const now = Date.now();
    if (now - lastBuzzAtRef.current < BUZZ_INTERVAL_MS) {
      return;
    }
    lastBuzzAtRef.current = now;

    const audio = await ensureAudioContext();
    if (!audio) {
      return;
    }

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.36);
  }

  async function postStatus(payload: DrowsinessUpdatePayload) {
    const signature = JSON.stringify([
      payload.status,
      payload.severity,
      payload.ear,
      payload.consecutive_closed_frames,
      payload.alarm_active,
    ]);
    const now = Date.now();
    if (signature === lastPostedSignatureRef.current && now - lastPostedAtRef.current < POST_INTERVAL_MS) {
      return;
    }

    lastPostedSignatureRef.current = signature;
    lastPostedAtRef.current = now;

    try {
      const saved = await postDrowsinessStatus(payload);
      if (isMountedRef.current) {
        setStatus(saved);
      }
    } catch {
      if (isMountedRef.current) {
        setStatus((current) => ({ ...current, ...payload }));
      }
    }
  }

  function drawOverlay(result: FaceLandmarkerResult | null, next: DrowsinessUpdatePayload) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.clearRect(0, 0, width, height);

    if (!result?.faceLandmarks?.length) {
      context.fillStyle = 'rgba(15, 23, 42, 0.72)';
      context.fillRect(16, 16, 280, 92);
      context.fillStyle = '#f8fafc';
      context.font = '600 15px Segoe UI';
      context.fillText('No face detected', 28, 45);
      context.font = '500 13px Segoe UI';
      context.fillText('Center your face inside the camera frame.', 28, 68);
      context.fillText('Drowsiness tracking starts as soon as a face is visible.', 28, 88);
      return;
    }

    const points = result.faceLandmarks[0].map((landmark) => ({
      x: landmark.x * width,
      y: landmark.y * height,
    }));

    context.fillStyle = next.alarm_active ? 'rgba(239, 68, 68, 0.9)' : 'rgba(56, 189, 248, 0.82)';
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
      context.fill();
    }

    const leftEye = LEFT_EYE.map((index) => points[index]);
    const rightEye = RIGHT_EYE.map((index) => points[index]);
    drawEyePath(context, leftEye, '#f59e0b');
    drawEyePath(context, rightEye, '#f59e0b');

    if (next.alarm_active) {
      context.strokeStyle = 'rgba(239, 68, 68, 0.95)';
      context.lineWidth = 4;
      context.strokeRect(8, 8, width - 16, height - 16);
    }

    context.fillStyle = 'rgba(15, 23, 42, 0.74)';
    context.fillRect(16, 16, 250, 94);
    context.fillStyle = '#f8fafc';
    context.font = '700 16px Segoe UI';
    context.fillText(next.status, 28, 42);
    context.font = '500 13px Segoe UI';
    context.fillText(`EAR ${next.ear?.toFixed(3) ?? '--'}`, 28, 66);
    context.fillText(`Eyes closed ${next.eyes_closed_seconds.toFixed(1)}s`, 28, 88);
  }

  function analyzeFrame() {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    let result: FaceLandmarkerResult | null = null;
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      result = landmarker.detectForVideo(video, performance.now());
    }

    const next = buildPayload({
      status: 'No face detected',
      severity: 'warning',
      ear: null,
      consecutive_closed_frames: 0,
      eyes_closed_seconds: 0,
      alarm_active: false,
      assistant_response: 'Center your face in the camera for live tracking.',
    });

    if (result?.faceLandmarks?.length) {
      const points = result.faceLandmarks[0].map((landmark) => ({ x: landmark.x, y: landmark.y }));
      const leftEye = LEFT_EYE.map((index) => points[index]);
      const rightEye = RIGHT_EYE.map((index) => points[index]);
      const ear = (computeEar(leftEye) + computeEar(rightEye)) / 2;

      if (ear < DEFAULT_THRESHOLD) {
        consecutiveClosedFramesRef.current += 1;
        if (closedSinceRef.current === null) {
          closedSinceRef.current = performance.now();
        }
      } else {
        consecutiveClosedFramesRef.current = 0;
        closedSinceRef.current = null;
      }

      const closedSeconds = closedSinceRef.current
        ? (performance.now() - closedSinceRef.current) / 1000
        : 0;
      const alarmActive =
        consecutiveClosedFramesRef.current >= CLOSED_FRAME_THRESHOLD ||
        closedSeconds >= CLOSED_SECONDS_THRESHOLD;

      next.status = alarmActive ? 'Drowsiness detected' : 'Face tracked live';
      next.severity = alarmActive ? 'critical' : 'normal';
      next.ear = Number(ear.toFixed(4));
      next.consecutive_closed_frames = consecutiveClosedFramesRef.current;
      next.eyes_closed_seconds = Number(closedSeconds.toFixed(2));
      next.alarm_active = alarmActive;
      next.assistant_response = alarmActive
        ? 'Eyes closed too long. Pull over safely and take a break.'
        : 'Face mesh is tracking live. Blink naturally and keep your eyes open.';
    } else {
      consecutiveClosedFramesRef.current = 0;
      closedSinceRef.current = null;
    }

    drawOverlay(result, next);
    void postStatus(next);

    if (next.alarm_active) {
      void buzz();
    }

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  }

  async function startCamera() {
    if (!isLive) {
      setError('Go live first, then open the camera.');
      return;
    }

    setCameraState('loading');
    setError(null);

    try {
      await ensureAudioContext();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support webcam access.');
      }

      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        }),
        CAMERA_START_TIMEOUT_MS,
        'Webcam permission timed out. Allow the camera in the browser and try again.',
      );

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not ready.');
      }

      video.srcObject = stream;
      await video.play();
      setCameraState('active');

      await postStatus(
        buildPayload({
          status: 'Camera live, loading face mesh...',
          severity: 'warning',
          ear: null,
          consecutive_closed_frames: 0,
          eyes_closed_seconds: 0,
          alarm_active: false,
          assistant_response: 'Webcam is open. Loading live face tracking on top of the video now.',
        }),
      );

      const vision = (await withTimeout(
        import(/* @vite-ignore */ VISION_BUNDLE_URL),
        FACE_MESH_LOAD_TIMEOUT_MS,
        'Face mesh bundle did not load. Check internet access and reload the page.',
      )) as VisionBundleModule;
      const visionFiles = await withTimeout(
        vision.FilesetResolver.forVisionTasks(VISION_WASM_URL),
        FACE_MESH_LOAD_TIMEOUT_MS,
        'Face mesh runtime did not initialize.',
      );
      const faceLandmarker = await withTimeout(
        vision.FaceLandmarker.createFromOptions(visionFiles, {
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        }),
        FACE_MESH_LOAD_TIMEOUT_MS,
        'Face mesh model did not load. Check internet access and reload the page.',
      );

      if (!isMountedRef.current) {
        faceLandmarker.close?.();
        return;
      }

      faceLandmarkerRef.current = faceLandmarker;

      const startingPayload = buildPayload({
        status: 'Face mesh live',
        severity: 'normal',
        ear: null,
        consecutive_closed_frames: 0,
        eyes_closed_seconds: 0,
        alarm_active: false,
        assistant_response: 'Camera opened. Face mesh is live and tracking will lock as soon as your face is visible.',
      });
      await postStatus(startingPayload);
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to start the camera.';
      const hasLiveVideo = Boolean(streamRef.current);
      setError(message);
      setCameraState(hasLiveVideo ? 'active' : 'error');

      await postStatus(
        buildPayload({
          status: hasLiveVideo ? 'Camera live, face mesh failed' : 'Camera unavailable',
          severity: 'warning',
          ear: null,
          consecutive_closed_frames: 0,
          eyes_closed_seconds: 0,
          alarm_active: false,
          assistant_response: message,
        }),
      );
    }
  }

  async function stopCamera() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    faceLandmarkerRef.current?.close?.();
    faceLandmarkerRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

    closedSinceRef.current = null;
    consecutiveClosedFramesRef.current = 0;
    lastVideoTimeRef.current = -1;
    setCameraState('idle');
    setError(null);

    await postStatus(
      buildPayload({
        status: isLive ? 'Camera stopped' : 'Driver offline',
        severity: 'warning',
        ear: null,
        consecutive_closed_frames: 0,
        eyes_closed_seconds: 0,
        alarm_active: false,
        assistant_response: isLive
          ? 'Open camera to resume live drowsiness tracking.'
          : 'Go live to enable the camera detector again.',
      }),
    );
  }

  const visual = severityClasses(status.severity);
  const isBusy = cameraState === 'loading';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-card p-6 border overflow-hidden',
        visual.border,
        visual.glow,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className={cn('w-5 h-5', visual.accent)} />
            <h3 className="font-bold text-[var(--text-primary)]">Live Drowsiness Camera</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Open the camera to see your live face mesh, eye tracking, and buzzer alerts directly on screen.
          </p>
        </div>

        <div className="flex gap-2">
          {cameraState !== 'active' ? (
            <button
              type="button"
              disabled={isBusy || !isLive}
              onClick={() => void startCamera()}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold bg-[var(--primary)] text-white disabled:opacity-60"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {isBusy ? 'Opening...' : 'Open Camera'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold bg-[var(--danger)] text-white"
            >
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_320px] gap-5">
        <div className="relative rounded-[24px] overflow-hidden border border-[var(--border)] bg-slate-950 min-h-[340px]">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn(
              'w-full h-full object-cover min-h-[340px]',
              cameraState === 'active' ? 'opacity-100' : 'opacity-0',
            )}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {cameraState !== 'active' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(30,41,59,0.86))]">
              <div className="text-center px-6">
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  {isBusy ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </div>
                <p className="text-lg font-bold text-white">
                  {isBusy ? 'Starting webcam and face mesh...' : 'Camera preview ready'}
                </p>
                <p className="text-sm text-slate-300 mt-2">
                  {isLive
                    ? 'Grant webcam permission and keep your face inside frame for live landmark tracking.'
                    : 'Switch the driver session to LIVE first.'}
                </p>
              </div>
            </div>
          )}

          {status.alarm_active && (
            <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-[var(--danger)] text-white text-xs font-black tracking-widest shadow-lg animate-pulse">
              DROWSY
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">Status</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{status.status}</p>
              </div>
              <span className={cn('px-3 py-2 rounded-full text-xs font-black tracking-widest', visual.badge)}>
                {status.severity.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-2xl bg-[var(--secondary)]/60 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">EAR</p>
                <p className="text-3xl font-black text-[var(--text-primary)] mt-1">
                  {typeof status.ear === 'number' ? status.ear.toFixed(3) : '--'}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--secondary)]/60 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Closed</p>
                <p className="text-3xl font-black text-[var(--text-primary)] mt-1">{status.eyes_closed_seconds.toFixed(1)}s</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2">
              {status.alarm_active ? (
                <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
              ) : (
                <Camera className="w-4 h-4 text-[var(--primary)]" />
              )}
              <p className="font-bold text-[var(--text-primary)]">Live feedback</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed">
              {error
                ? error
                : status.assistant_response ?? 'Open the camera to start live facial landmark tracking and drowsiness detection.'}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
