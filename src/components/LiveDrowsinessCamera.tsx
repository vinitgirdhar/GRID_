import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, ShieldAlert } from 'lucide-react';
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
const MOUTH = [78, 81, 13, 311, 308, 402, 14, 178, 78] as const;
const DEFAULT_THRESHOLD = 0.23;
const YAWN_THRESHOLD = 0.5;
const JAW_OPEN_THRESHOLD = 0.7;
const YAWN_SUSTAINED_SECONDS = 1.5;
const CLOSED_FRAME_THRESHOLD = 20;
const CLOSED_SECONDS_THRESHOLD = 2;
const POST_INTERVAL_MS = 900;
const BUZZ_INTERVAL_MS = 1100;
const CAMERA_START_TIMEOUT_MS = 12000;
const FACE_MESH_LOAD_TIMEOUT_MS = 15000;

type Landmark = { x: number; y: number; z?: number };
type BlendshapeCategory = { categoryName: string; score: number };
type FaceLandmarkerResult = {
  faceLandmarks?: Landmark[][];
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};
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

type SafetyLogTone = 'critical' | 'warning';
type SafetyLogEntry = {
  id: string;
  time: string;
  label: string;
  tone: SafetyLogTone;
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


function computeMouthRatio(points: { x: number; y: number }[]) {
  const vertical = distance(points[2], points[6]);
  const horizontal = distance(points[0], points[4]);
  if (!horizontal) {
    return 0;
  }
  return vertical / horizontal;
}


function blendshapeScore(result: FaceLandmarkerResult | null, name: string) {
  const categories = result?.faceBlendshapes?.[0]?.categories;
  if (!categories) {
    return 0;
  }
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
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

function drawRoundedPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawMetricTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  drawRoundedPanel(context, x, y, width, 64, 16, 'rgba(15, 23, 42, 0.78)', 'rgba(255,255,255,0.08)');
  context.fillStyle = 'rgba(148, 163, 184, 0.95)';
  context.font = '700 11px Segoe UI';
  context.fillText(label, x + 16, y + 22);
  context.fillStyle = '#f8fafc';
  context.font = '700 24px Segoe UI';
  context.fillText(value, x + 16, y + 48);
}

function drawStatusChip(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  fill: string,
) {
  const width = Math.max(112, 22 + label.length * 8.2);
  drawRoundedPanel(context, x, y, width, 34, 17, fill);
  context.fillStyle = '#f8fafc';
  context.font = '700 12px Segoe UI';
  context.fillText(label, x + 14, y + 21);
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

function formatLogTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}


async function requestCameraStream(setLoadingStep: (value: string) => void) {
  console.log('[Camera] Starting stream request sequence...');
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    console.log('[Camera] Available video devices:', videoDevices);
    
    if (videoDevices.length === 0) {
      throw new Error('No webcam devices found on this system.');
    }
  } catch (e) {
    console.warn('[Camera] Failed to enumerate devices:', e);
  }

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
      console.log(`[Camera] Attempting: ${attempt.step}`, attempt.constraints);
      setLoadingStep(attempt.step);
      
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia(attempt.constraints),
        10000,
        `Timed out at step: ${attempt.step}`,
      );
      
      console.log('[Camera] Stream successfully obtained!', stream.id);
      return stream;
    } catch (error) {
      console.error(`[Camera] Attempt failed (${attempt.step}):`, error);
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to open the webcam after multiple attempts.');
}


function waitForVideoMetadata(video: HTMLVideoElement, timeoutMs: number) {
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


export default function LiveDrowsinessCamera({ isLive }: { isLive: boolean }) {
  const [cameraState, setCameraState] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [eventLogs, setEventLogs] = useState<SafetyLogEntry[]>([]);

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
  const yawnSinceRef = useRef<number | null>(null);
  const consecutiveClosedFramesRef = useRef(0);
  const lastPostedSignatureRef = useRef<string>('');
  const lastPostedAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBuzzAtRef = useRef(0);
  const isMountedRef = useRef(true);
  const latestResultRef = useRef<FaceLandmarkerResult | null>(null);
  const hasTrackedFaceRef = useRef(false);
  const lastLoggedEventRef = useRef<string | null>(null);
  const fatigueEventCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    console.log('[Camera] Component mounted');
    return () => {
      console.log('[Camera] Component unmounting. Cleaning up...');
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

  function appendEventLog(label: string, tone: SafetyLogTone) {
    const now = new Date();
    const nextEntry: SafetyLogEntry = {
      id: `${now.getTime()}-${label}`,
      time: formatLogTime(now),
      label,
      tone,
    };

    fatigueEventCountRef.current += 1;
    setEventLogs((current) => [nextEntry, ...current].slice(0, 8));
  }

  function drawOverlay(
    result: FaceLandmarkerResult | null,
    next: DrowsinessUpdatePayload,
    fatigueEventCount: number,
  ) {
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
    context.lineJoin = 'round';
    context.lineCap = 'round';

    if (!result?.faceLandmarks?.length) {
      drawRoundedPanel(context, 18, 18, 340, 112, 24, 'rgba(15, 23, 42, 0.74)', 'rgba(255,255,255,0.08)');
      context.fillStyle = 'rgba(56, 189, 248, 0.95)';
      context.font = '700 12px Segoe UI';
      context.fillText('GRID DRIVER MONITOR', 34, 42);
      context.fillStyle = '#f8fafc';
      context.font = '700 24px Segoe UI';
      context.fillText('Awaiting Face Lock', 34, 76);
      context.fillStyle = 'rgba(226, 232, 240, 0.95)';
      context.font = '500 13px Segoe UI';
      context.fillText('Center your face in frame to start live analytics.', 34, 99);

      drawStatusChip(context, width - 170, 22, 'CAMERA LIVE', 'rgba(14,165,233,0.92)');
      return;
    }

    const points = result.faceLandmarks[0].map((landmark) => ({
      x: landmark.x * width,
      y: landmark.y * height,
    }));

    context.fillStyle = next.alarm_active ? 'rgba(248, 113, 113, 0.95)' : 'rgba(125, 211, 252, 0.92)';
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, next.alarm_active ? 1.8 : 1.55, 0, Math.PI * 2);
      context.fill();
    }

    const leftEye = LEFT_EYE.map((index) => points[index]);
    const rightEye = RIGHT_EYE.map((index) => points[index]);
    const mouth = MOUTH.map((index) => points[index]);
    drawEyePath(context, leftEye, next.alarm_active ? '#fb7185' : '#f59e0b');
    drawEyePath(context, rightEye, next.alarm_active ? '#fb7185' : '#f59e0b');
    drawEyePath(context, mouth, '#22c55e');

    const leftEyeAnchor = leftEye[0];
    const rightEyeAnchor = rightEye[3];
    context.fillStyle = '#f8fafc';
    context.font = '700 11px Segoe UI';
    context.fillText('LEFT EYE', leftEyeAnchor.x - 8, leftEyeAnchor.y - 14);
    context.fillText('RIGHT EYE', rightEyeAnchor.x - 22, rightEyeAnchor.y - 14);

    if (next.alarm_active) {
      context.strokeStyle = 'rgba(239, 68, 68, 0.95)';
      context.lineWidth = 4;
      context.strokeRect(8, 8, width - 16, height - 16);
    }

    const heroFill = next.alarm_active
      ? 'rgba(127, 29, 29, 0.86)'
      : next.severity === 'warning'
        ? 'rgba(120, 53, 15, 0.84)'
        : 'rgba(15, 23, 42, 0.76)';

    drawRoundedPanel(context, 18, 18, 360, 120, 24, heroFill, 'rgba(255,255,255,0.08)');
    context.fillStyle = next.alarm_active ? '#fca5a5' : next.severity === 'warning' ? '#fdba74' : '#7dd3fc';
    context.font = '700 12px Segoe UI';
    context.fillText('LIVE DRIVER SAFETY MONITOR', 34, 42);
    context.fillStyle = '#f8fafc';
    context.font = next.alarm_active ? '700 24px Segoe UI' : '700 22px Segoe UI';
    context.fillText(next.alarm_active ? 'DRIVER DROWSINESS DETECTED' : next.status.toUpperCase(), 34, 78);
    context.fillStyle = 'rgba(226, 232, 240, 0.95)';
    context.font = '500 13px Segoe UI';
    context.fillText(
      next.alarm_active ? 'Alert triggered. Recommend immediate safe break.' : 'Face landmarks, eyes, and fatigue telemetry are live.',
      34,
      103,
    );

    const metricY = height - 92;
    const metricWidth = Math.min(152, (width - 52) / 3);
    drawMetricTile(context, 18, metricY, metricWidth, 'EAR', next.ear?.toFixed(3) ?? '--');
    drawMetricTile(context, 28 + metricWidth, metricY, metricWidth, 'STATUS', next.alarm_active ? 'ALERT' : next.severity.toUpperCase());
    drawMetricTile(context, 38 + metricWidth * 2, metricY, metricWidth, 'EVENTS', String(fatigueEventCount));

    drawStatusChip(
      context,
      width - 164,
      22,
      next.alarm_active ? 'ALERT TRIGGERED' : 'TRACKING LIVE',
      next.alarm_active ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.9)',
    );
  }

  function analyzeFrame() {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    const frameTimestamp = performance.now();
    if (!video || !landmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    let result = latestResultRef.current;
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      result = landmarker.detectForVideo(video, frameTimestamp);
      latestResultRef.current = result;
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

    let eventLabel: string | null = null;
    let eventTone: SafetyLogTone | null = null;

    if (result?.faceLandmarks?.length) {
      hasTrackedFaceRef.current = true;
      const points = result.faceLandmarks[0].map((landmark) => ({ x: landmark.x, y: landmark.y }));
      const leftEye = LEFT_EYE.map((index) => points[index]);
      const rightEye = RIGHT_EYE.map((index) => points[index]);
      const mouth = MOUTH.map((index) => points[index]);
      const ear = (computeEar(leftEye) + computeEar(rightEye)) / 2;
      const mouthRatio = computeMouthRatio(mouth);
      const jawOpenScore = blendshapeScore(result, 'jawOpen');
      const rawYawnDetected = mouthRatio >= YAWN_THRESHOLD || jawOpenScore >= JAW_OPEN_THRESHOLD;

      if (rawYawnDetected) {
        if (yawnSinceRef.current === null) {
          yawnSinceRef.current = frameTimestamp;
        }
      } else {
        yawnSinceRef.current = null;
      }

      const yawnDetected =
        yawnSinceRef.current !== null &&
        (frameTimestamp - yawnSinceRef.current) / 1000 >= YAWN_SUSTAINED_SECONDS;

      if (ear < DEFAULT_THRESHOLD) {
        consecutiveClosedFramesRef.current += 1;
        if (closedSinceRef.current === null) {
          closedSinceRef.current = frameTimestamp;
        }
      } else {
        consecutiveClosedFramesRef.current = 0;
        closedSinceRef.current = null;
      }

      const closedSeconds = closedSinceRef.current !== null
        ? (frameTimestamp - closedSinceRef.current) / 1000
        : 0;
      const alarmActive =
        consecutiveClosedFramesRef.current >= CLOSED_FRAME_THRESHOLD ||
        closedSeconds >= CLOSED_SECONDS_THRESHOLD;

      next.status = alarmActive
        ? 'Drowsiness detected'
        : yawnDetected
          ? 'Yawning detected'
          : 'Face tracked live';
      next.severity = alarmActive ? 'critical' : yawnDetected ? 'warning' : 'normal';
      next.ear = Number(ear.toFixed(4));
      next.consecutive_closed_frames = consecutiveClosedFramesRef.current;
      next.eyes_closed_seconds = Number(closedSeconds.toFixed(2));
      next.alarm_active = alarmActive;
      next.assistant_response = alarmActive
        ? 'Eyes closed too long. Pull over safely and take a break.'
        : yawnDetected
          ? 'Yawning detected. Stay alert, breathe deeply, and consider a short break soon.'
        : 'Face mesh is tracking live. Blink naturally and keep your eyes open.';

      if (alarmActive) {
        eventLabel = 'Drowsiness detected';
        eventTone = 'critical';
      } else if (yawnDetected) {
        eventLabel = 'Yawning detected';
        eventTone = 'warning';
      }
    } else {
      consecutiveClosedFramesRef.current = 0;
      closedSinceRef.current = null;
      yawnSinceRef.current = null;
      if (hasTrackedFaceRef.current) {
        eventLabel = 'Driver distracted';
        eventTone = 'warning';
      }
    }

    if (eventLabel && eventTone) {
      if (lastLoggedEventRef.current !== eventLabel) {
        appendEventLog(eventLabel, eventTone);
        lastLoggedEventRef.current = eventLabel;
      }
    } else {
      lastLoggedEventRef.current = null;
    }

    drawOverlay(result, next, fatigueEventCountRef.current);
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
      console.log('[Camera] Step 1: Requesting Stream');
      setLoadingStep('Requesting camera permission...');
      const stream = await requestCameraStream(setLoadingStep);

      // Relaxed check: only abort if strictly unmounted
      if (isMountedRef.current === false) {
        console.warn('[Camera] Component unmounted during stream request. Stopping tracks.');
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      console.log('[Camera] Step 2: Initializing Stream');
      setLoadingStep('Initializing video stream...');
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Internal Error: Video element not found.');
      }

      console.log('[Camera] Step 3: Binding stream to video element');
      setLoadingStep('Binding webcam stream...');
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      
      // We set active here so the UI shows the video element
      setCameraState('active');

      console.log('[Camera] Step 4: Waiting for metadata');
      setLoadingStep('Waiting for video frames...');
      await waitForVideoMetadata(video, 10000);
      
      console.log('[Camera] Step 5: Starting playback');
      await video.play().catch(e => console.warn('[Camera] Play failed but continuing:', e));

      console.log('[Camera] Step 6: Initializing MediaPipe');
      await postStatus(
        buildPayload({
          status: 'Camera live, loading AI...',
          severity: 'warning',
          ear: null,
          consecutive_closed_frames: 0,
          eyes_closed_seconds: 0,
          alarm_active: false,
          assistant_response: 'Webcam is open. Loading facial landmark tracking now...',
        }),
      );

      setLoadingStep('Loading face mesh bundle...');
      const vision = (await withTimeout(
        import(/* @vite-ignore */ VISION_BUNDLE_URL),
        20000,
        'Face mesh bundle did not load. Check internet access and reload the page.',
      )) as VisionBundleModule;

      setLoadingStep('Initializing vision runtime...');
      const visionFiles = await withTimeout(
        vision.FilesetResolver.forVisionTasks(VISION_WASM_URL),
        20000,
        'Face mesh runtime did not initialize.',
      );

      setLoadingStep('Downloading face tracking model...');
      const faceLandmarker = await withTimeout(
        vision.FaceLandmarker.createFromOptions(visionFiles, {
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          minFaceDetectionConfidence: 0.25,
          minFacePresenceConfidence: 0.25,
          minTrackingConfidence: 0.25,
          numFaces: 1,
        }),
        25000,
        'Face mesh model did not load (Internet may be slow). Please refresh and try again.',
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
    yawnSinceRef.current = null;
    consecutiveClosedFramesRef.current = 0;
    lastVideoTimeRef.current = -1;
    latestResultRef.current = null;
    hasTrackedFaceRef.current = false;
    lastLoggedEventRef.current = null;
    fatigueEventCountRef.current = 0;
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
  const fatigueEventCount = eventLogs.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-card p-5 sm:p-6 border overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]',
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
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
            Open the camera to see your live face mesh, eye tracking, and buzzer alerts directly on screen.
          </p>
        </div>

        <div className="flex gap-2">
          {cameraState !== 'active' ? (
            <button
              type="button"
              disabled={isBusy || !isLive}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void startCamera();
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold bg-[var(--primary)] text-white disabled:opacity-60"
            >
              {isBusy ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {isBusy ? (loadingStep || 'Opening...') : 'Open Camera'}
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
              'w-full h-full object-cover min-h-[340px] scale-x-[-1]',
              cameraState === 'active' ? 'opacity-100' : 'opacity-0',
            )}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {cameraState !== 'active' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(30,41,59,0.86))]">
              <div className="text-center px-6" style={{ minWidth: 0 }}>
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  {isBusy ? (
                    <div className="w-8 h-8 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </div>
                <p className="text-lg font-bold text-white">
                  {isBusy ? (loadingStep || 'Starting webcam...') : 'Camera preview ready'}
                </p>
                <p className="text-sm text-slate-300 mt-2">
                  {isLive
                    ? (loadingStep.includes('permission') ? 'Please check the permission popup in your browser.' : 'Stay in frame for live landmark tracking.')
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
          <div className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">Driver Status</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{status.status}</p>
              </div>
              <span className={cn('px-3 py-2 rounded-full text-xs font-black tracking-widest', visual.badge)}>
                {status.severity.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5">
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
              <div className="rounded-2xl bg-[var(--secondary)]/60 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Events</p>
                <p className="text-3xl font-black text-[var(--text-primary)] mt-1">{fatigueEventCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
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

      <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Driver Safety Log</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Live session events captured from the camera detector.
            </p>
          </div>
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {eventLogs.length} event{eventLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {eventLogs.length > 0 ? (
            eventLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shrink-0',
                      entry.tone === 'critical' ? 'bg-[var(--danger)]' : 'bg-sky-500',
                    )}
                  />
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{entry.label}</p>
                </div>
                <span className="text-sm font-bold text-[var(--text-secondary)] shrink-0">{entry.time}</span>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--text-secondary)] text-center">
              No safety events yet. Open the camera and the log will record drowsiness, yawning, and distraction events with timestamps.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
