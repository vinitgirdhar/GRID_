import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '../lib/utils';
import { postDrowsinessStatus } from '../services/apiService';
import { DrowsinessResponse, DrowsinessSeverity, DrowsinessUpdatePayload } from '../types';


const VISION_WASM_URL = '/mediapipe-wasm';
const FACE_LANDMARKER_MODEL_URL =
  '/mediapipe-models/face_landmarker.task';

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
const CAMERA_START_TIMEOUT_MS = 20000;
const VISION_BUNDLE_TIMEOUT_MS = 90000;
const FACE_MESH_LOAD_TIMEOUT_MS = 120000;

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
      badge: 'bg-amber-500 text-white',
      border: 'border-amber-500/30',
      accent: 'text-amber-500',
      glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.22)]',
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
      step: 'Requesting camera...',
      constraints: {
        video: {
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
        CAMERA_START_TIMEOUT_MS,
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


export default function LiveDrowsinessCamera({ isLive, onGoLive }: { isLive: boolean; onGoLive?: () => void }) {
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

    const leftEye = LEFT_EYE.map((index) => points[index]);
    const rightEye = RIGHT_EYE.map((index) => points[index]);
    const mouth = MOUTH.map((index) => points[index]);

    // Flip context horizontally so landmark mesh matches the CSS-mirrored video feed
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);

    context.fillStyle = next.alarm_active ? 'rgba(248, 113, 113, 0.95)' : 'rgba(125, 211, 252, 0.92)';
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, next.alarm_active ? 1.8 : 1.55, 0, Math.PI * 2);
      context.fill();
    }

    drawEyePath(context, leftEye, next.alarm_active ? '#fb7185' : '#f59e0b');
    drawEyePath(context, rightEye, next.alarm_active ? '#fb7185' : '#f59e0b');
    drawEyePath(context, mouth, '#22c55e');

    // Restore normal (unflipped) context before drawing any text so it stays readable
    context.restore();

    // Draw eye labels at mirrored screen-space positions (width - x) so they sit over the correct eye
    const leftEyeScreenX = width - leftEye[0].x;
    const rightEyeScreenX = width - rightEye[3].x;
    context.fillStyle = '#f8fafc';
    context.font = '700 11px Segoe UI';
    context.fillText('LEFT EYE', leftEyeScreenX - 8, leftEye[0].y - 14);
    context.fillText('RIGHT EYE', rightEyeScreenX - 22, rightEye[3].y - 14);

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
      await waitForVideoMetadata(video, CAMERA_START_TIMEOUT_MS);
      
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
        import('@mediapipe/tasks-vision'),
        VISION_BUNDLE_TIMEOUT_MS,
        'Face mesh bundle did not load. Check internet access and reload the page.',
      )) as VisionBundleModule;

      setLoadingStep('Initializing vision runtime...');
      const visionFiles = await withTimeout(
        vision.FilesetResolver.forVisionTasks(VISION_WASM_URL),
        FACE_MESH_LOAD_TIMEOUT_MS,
        'Face mesh runtime did not initialize from the bundled site assets.',
      );

      setLoadingStep('Loading bundled face tracking model...');
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
        FACE_MESH_LOAD_TIMEOUT_MS,
        'Face mesh model did not load from the bundled site assets. Please refresh and try again.',
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
        'bento-card relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-4 sm:p-6 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group',
        visual.border,
        visual.glow,
      )}
    >
      <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-400" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex mt-0.5">
            <ShieldAlert className={cn('w-4 h-4 shrink-0', visual.accent)} />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading font-medium text-[var(--text-primary)] leading-tight">Live Drowsiness Camera</h3>
            <p className="text-sm font-light text-[var(--text-secondary)] mt-0.5 leading-snug">
              Open the camera to see live face mesh, eye tracking, and buzzer alerts.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {cameraState !== 'active' ? (
            !isLive && onGoLive ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGoLive();
                  setTimeout(() => void startCamera(), 300);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-8 py-2.5 rounded-full font-medium text-[var(--accent)] bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.15)] hover:border-[rgba(250,204,21,0.6)] hover:-translate-y-[2px] hover:shadow-[0_4px_20px_rgba(250,204,21,0.15)] transition-all duration-300 max-w-full text-center"
              >
                <Camera className="w-4 h-4" />
                Go Live & Open Camera
              </button>
            ) : (
              <button
                type="button"
                disabled={isBusy || !isLive}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void startCamera();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-8 py-2.5 rounded-full font-medium text-[var(--accent)] bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.15)] hover:border-[rgba(250,204,21,0.6)] hover:-translate-y-[2px] hover:shadow-[0_4px_20px_rgba(250,204,21,0.15)] transition-all duration-300 disabled:opacity-60 max-w-full text-center"
              >
                {isBusy ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {isBusy ? (loadingStep || 'Opening...') : 'Open Camera'}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium border border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-all whitespace-nowrap"
            >
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </button>
          )}
        </div>
      </div>

      {/* Camera + Stats: stacked on mobile, side-by-side from lg */}
      <div className="mt-4 flex flex-col lg:flex-row gap-4">
        {/* Camera feed */}
        <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-alt)] w-full lg:flex-1 min-h-[260px] sm:min-h-[320px]">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn(
              'w-full h-full object-contain min-h-[260px] sm:min-h-[320px] scale-x-[-1]',
              cameraState === 'active' ? 'opacity-100' : 'opacity-0',
            )}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {cameraState !== 'active' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(5,5,20,0.92),rgba(10,10,30,0.9))]">
              <div className="text-center px-6" style={{ minWidth: 0 }}>
                <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 border border-[var(--border)] flex items-center justify-center mx-auto mb-3">
                  {isBusy ? (
                    <div className="w-7 h-7 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                  ) : (
                    <Camera className="w-7 h-7 text-[var(--accent)]" />
                  )}
                </div>
                <p className="text-base font-heading font-medium text-[var(--text-primary)]">
                  {isBusy ? (loadingStep || 'Starting webcam...') : 'Camera preview ready'}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-[230px] mx-auto leading-snug">
                  {isLive
                    ? (loadingStep.includes('permission') ? 'Check the permission popup in your browser.' : 'Stay in frame for live landmark tracking.')
                    : 'Tap "Go Live & Open Camera" above to start.'}
                </p>
              </div>
            </div>
          )}

          {status.alarm_active && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[var(--danger)] text-white text-[10px] font-black tracking-widest shadow-lg animate-pulse">
              DROWSY
            </div>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
          {/* Status card */}
          <div className="bento-card relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-4 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group">
            <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-400" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Driver Status</p>
                <p className="text-base font-heading font-medium text-[var(--text-primary)] mt-1 leading-tight break-words">{status.status}</p>
              </div>
              <span className={cn('shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-widest whitespace-nowrap', visual.badge)}>
                {status.severity.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl bg-white/5 border border-[var(--border)] px-3 py-2.5">
                <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">EAR</p>
                <p className="text-lg font-heading font-medium text-[var(--text-primary)] mt-0.5 tabular-nums">
                  {typeof status.ear === 'number' ? status.ear.toFixed(3) : '--'}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-[var(--border)] px-3 py-2.5">
                <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Closed</p>
                <p className="text-lg font-heading font-medium text-[var(--text-primary)] mt-0.5 tabular-nums">{status.eyes_closed_seconds.toFixed(1)}s</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-[var(--border)] px-3 py-2.5">
                <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Events</p>
                <p className="text-lg font-heading font-medium text-[var(--text-primary)] mt-0.5 tabular-nums">{fatigueEventCount}</p>
              </div>
            </div>
          </div>

          {/* Live feedback card */}
          <div className="bento-card relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-4 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group">
            <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-400" />
            <div className="flex items-center gap-2">
              {status.alarm_active ? (
                <AlertTriangle className="w-4 h-4 text-[var(--danger)] shrink-0" />
              ) : (
                <Camera className="w-4 h-4 text-[var(--accent)] shrink-0" />
              )}
              <p className="font-heading font-medium text-sm text-[var(--text-primary)]">Live feedback</p>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-2.5 leading-relaxed">
              {error
                ? error
                : status.assistant_response ?? 'Open the camera to start live facial landmark tracking and drowsiness detection.'}
            </p>
          </div>
        </div>
      </div>

      {/* Safety log */}
      <div className="mt-4 bento-card relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-4 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group">
        <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-400" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Driver Safety Log</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Live session events from the camera detector.
            </p>
          </div>
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-[var(--text-secondary)] shrink-0">
            {eventLogs.length} event{eventLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {eventLogs.length > 0 ? (
            eventLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      entry.tone === 'critical' ? 'bg-[var(--danger)]' : 'bg-amber-500',
                    )}
                  />
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.label}</p>
                </div>
                <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">{entry.time}</span>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/5 px-4 py-5 text-xs text-[var(--text-secondary)] text-center leading-relaxed">
              No safety events yet. Open the camera to record drowsiness, yawning, and distraction events.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
