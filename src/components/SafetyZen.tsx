import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, Wind, Shield, Coffee, Leaf } from 'lucide-react';
import { cn } from '../lib/utils';
import { getWellnessStatus } from '../services/apiService';

type ZenPhase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'done';

const BREATHING_CYCLE = [
  { phase: 'inhale' as ZenPhase, label: 'Breathe In', duration: 4000, color: 'var(--primary)' },
  { phase: 'hold' as ZenPhase, label: 'Hold', duration: 4000, color: 'var(--warning)' },
  { phase: 'exhale' as ZenPhase, label: 'Breathe Out', duration: 6000, color: 'var(--success)' },
];

const WELLNESS_TIPS = [
  "Take a sip of water before your next ride.",
  "A 10-minute break every 2 hours improves focus significantly.",
  "Your most profitable hours are peak morning and evening rushes.",
  "Eye strain? Look at something 20 feet away for 20 seconds.",
  "Adjust your seat posture — your back will thank you.",
];

const HEART_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/%3E%3C/svg%3E")`;

const HEART_MASK_STYLE = {
  WebkitMaskImage: HEART_MASK,
  maskImage: HEART_MASK,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
} as const;

export default function SafetyZen({ isLive }: { isLive?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prevIsLive, setPrevIsLive] = useState(isLive);
  const [isFilling, setIsFilling] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [hasDismissedBreakModal, setHasDismissedBreakModal] = useState(false);
  const [phase, setPhase] = useState<ZenPhase>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [tip] = useState(() => WELLNESS_TIPS[Math.floor(Math.random() * WELLNESS_TIPS.length)]);
  const [driveMinutes, setDriveMinutes] = useState(0);
  const [progress, setProgress] = useState(0);

  // Sync with Backend Wellness Simulation
  useEffect(() => {
    const fetchWellness = async () => {
      try {
        const data = await getWellnessStatus();

        setDriveMinutes(data.drive_minutes);
        setIsFilling(data.is_filling);
        setProgress(data.progress);
        setShowBreakModal(data.progress >= 1.0 && data.is_live && !hasDismissedBreakModal);
      } catch (e) {
        // Fallback to local if backend is down
      }
    };

    const poll = setInterval(fetchWellness, 15000); // Poll every 15s
    fetchWellness();
    return () => clearInterval(poll);
  }, [hasDismissedBreakModal]);

  // Reset one-time break prompt per live session and close it when the driver goes offline.
  useEffect(() => {
    if (!isLive) {
      setShowBreakModal(false);
      setHasDismissedBreakModal(false);
    } else if (prevIsLive === false) {
      setHasDismissedBreakModal(false);
    }

    setPrevIsLive(isLive);
  }, [isLive, prevIsLive]);

  const runBreathingCycle = useCallback(() => {
    let cycleIndex = 0;
    let currentCycles = 0;
    const maxCycles = 3;

    const nextStep = () => {
      if (currentCycles >= maxCycles) {
        setPhase('done');
        setIsRunning(false);
        setCycleCount((c) => c + maxCycles);
        return;
      }

      const current = BREATHING_CYCLE[cycleIndex];
      setPhase(current.phase);

      setTimeout(() => {
        cycleIndex++;
        if (cycleIndex >= BREATHING_CYCLE.length) {
          cycleIndex = 0;
          currentCycles++;
        }
        nextStep();
      }, current.duration);
    };

    nextStep();
  }, []);

  const startBreathing = () => {
    if (isRunning) return;
    setIsRunning(true);
    setPhase('idle');
    setTimeout(runBreathingCycle, 500);
  };

  const currentCycle = BREATHING_CYCLE.find((c) => c.phase === phase);
  const orbScale = phase === 'inhale' ? 1.5 : phase === 'hold' ? 1.5 : phase === 'exhale' ? 0.8 : 1.0;
  const orbColor = currentCycle?.color ?? 'var(--primary)';

  const fatigueLevel = driveMinutes < 60 ? 'low' : driveMinutes < 120 ? 'moderate' : 'high';
  const fatigueColor = fatigueLevel === 'low' ? 'text-[var(--success)]' : fatigueLevel === 'moderate' ? 'text-[var(--warning)]' : 'text-[var(--danger)]';
  const fatigueBg = fatigueLevel === 'low' ? 'bg-[var(--success)]/10 border-[var(--success)]/20' : fatigueLevel === 'moderate' ? 'bg-[var(--warning)]/10 border-[var(--warning)]/20' : 'bg-[var(--danger)]/10 border-[var(--danger)]/20';
  const fatigueText = fatigueLevel === 'low' ? 'Fresh' : fatigueLevel === 'moderate' ? 'Monitor' : 'Break Recommended';

  return (
    <>
      {/* Floating Heart Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-44 right-4 sm:right-6 lg:bottom-24 lg:right-9 w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-[60] transition-colors overflow-hidden',
          fatigueLevel === 'high'
            ? 'bg-[var(--danger)] text-white animate-pulse'
            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--danger)] hover:bg-red-50'
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        title="Driver Wellness"
      >
        <div className="relative z-10 w-6 h-6 flex items-center justify-center">
          <AnimatePresence>
            {isFilling && (
              <div className="absolute inset-0" style={HEART_MASK_STYLE}>
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: `${100 - (progress * 100)}%` }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-red-500/85"
                  style={{
                    backgroundImage: 'linear-gradient(0deg, rgba(220,38,38,0.96) 0%, rgba(248,113,113,0.65) 100%)'
                  }}
                >
                  <motion.div
                    className="absolute top-0 left-[-45%] w-[190%] h-3 bg-red-300/70 rounded-[45%]"
                    animate={{ x: [0, 8, 0], rotate: [0, 4, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <Heart className="w-5 h-5 relative z-10" />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsOpen(false); setPhase('idle'); setIsRunning(false); }}
          >
            <motion.div
              className="w-full max-w-sm bg-[var(--surface)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 pb-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--danger)]/10 rounded-xl">
                    <Shield className="w-5 h-5 text-[var(--danger)]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-[var(--text-primary)]">Driver Wellness</h2>
                    <p className="text-xs text-[var(--text-secondary)]">Your safety, our priority</p>
                  </div>
                </div>
                <button onClick={() => { setIsOpen(false); setPhase('idle'); setIsRunning(false); }}>
                  <X className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              {/* Fatigue Status */}
              <div className={cn('mx-6 mt-5 p-3 rounded-2xl border flex items-center justify-between', fatigueBg)}>
                <div className="flex items-center gap-2">
                  <Coffee size={14} className={fatigueColor} />
                  <span className="text-xs font-bold text-[var(--text-secondary)]">Drive Time: {driveMinutes}m</span>
                </div>
                <span className={cn('text-xs font-black uppercase tracking-wider', fatigueColor)}>{fatigueText}</span>
              </div>              {/* Breathing Orb */}
              <div className="flex flex-col items-center py-10 gap-6">
                <div className="relative flex items-center justify-center w-56 h-56">
                  {/* Energy Aura */}
                  <AnimatePresence>
                    {isRunning && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ 
                          opacity: [0.3, 0.6, 0.3],
                          scale: [1, 1.4, 1],
                          rotate: [0, 90, 180, 270, 360]
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full blur-3xl opacity-30"
                        style={{ 
                          background: `conic-gradient(from 0deg, ${orbColor}, transparent, ${orbColor})` 
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Pulsing outer rings (multiple layers for depth) */}
                  <motion.div
                    className="absolute inset-0 rounded-full border border-white/10"
                    animate={isRunning ? { scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] } : { scale: 1, opacity: 0.1 }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-6 rounded-full border border-white/20"
                    animate={isRunning ? { scale: [1, 1.05, 1], opacity: [0.2, 0.4, 0.2] } : { scale: 1, opacity: 0.2 }}
                    transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
                  />

                  {/* Main Orb Container */}
                  <motion.div
                    className="relative w-36 h-36 rounded-full flex items-center justify-center z-10"
                    animate={{ 
                      scale: orbScale,
                      boxShadow: isRunning 
                        ? [`0 0 20px ${orbColor}44`, `0 0 50px ${orbColor}66`, `0 0 20px ${orbColor}44`]
                        : '0 0 20px rgba(0,0,0,0.1)'
                    }}
                    transition={{ 
                      scale: { duration: phase === 'inhale' ? 4 : phase === 'exhale' ? 6 : 0.6, ease: 'easeInOut' },
                      boxShadow: { duration: 2, repeat: Infinity }
                    }}
                  >
                    {/* Glassmorphism Surface */}
                    <div className="absolute inset-0 rounded-full glass-card border-none shadow-none backdrop-blur-xl overflow-hidden">
                      {/* Dynamic Gradient Background */}
                      <motion.div 
                        className="absolute inset-0 opacity-80"
                        animate={{ 
                          backgroundColor: orbColor,
                          background: `radial-gradient(circle at 30% 30%, white, ${orbColor})`
                        }}
                      />
                      
                      {/* Animated "Liquid" fill */}
                      <AnimatePresence>
                        {isRunning && (
                          <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: phase === 'inhale' ? '0%' : phase === 'exhale' ? '100%' : '0%' }}
                            transition={{ duration: phase === 'inhale' ? 4 : phase === 'exhale' ? 6 : 0.1 }}
                            className="absolute inset-0 bg-white/30 blur-sm"
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Content inside Orb */}
                    <div className="relative z-20 flex flex-col items-center">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={phase}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex flex-col items-center"
                        >
                          {phase === 'idle' ? (
                            <Wind className="w-10 h-10 text-[var(--text-muted)] opacity-50" />
                          ) : phase === 'hold' ? (
                            <div className="w-4 h-4 rounded-full bg-white opacity-80 animate-ping" />
                          ) : (
                            <motion.div
                              animate={{ y: phase === 'inhale' ? [-4, 4, -4] : [4, -4, 4] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Wind className="w-10 h-10 text-white shadow-sm" />
                            </motion.div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </div>

                {/* Status UI */}
                <div className="text-center w-full px-6">
                  <AnimatePresence mode="wait">
                    {isRunning ? (
                      <motion.div
                        key={phase}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-1"
                      >
                        <p className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                          {currentCycle?.label}
                        </p>
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
                          Phase: {phase}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        {phase === 'done' ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--success)]/10 text-[var(--success)] rounded-full border border-[var(--success)]/20">
                              <Leaf size={14} />
                              <span className="text-sm font-bold">Session Complete</span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] font-medium">Your heart rate and focus have been optimized.</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[var(--text-primary)] font-bold">Resonance Breathing</p>
                            <p className="text-[var(--text-muted)] text-xs font-medium">3 breathing cycles to reset your internal rhythm</p>
                          </div>
                        )}
                        {cycleCount > 0 && (
                          <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-center gap-8">
                            <div className="text-center">
                              <p className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-widest leading-none mb-1">Total</p>
                              <p className="text-lg font-black text-[var(--text-primary)]">{cycleCount}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-widest leading-none mb-1">Goal</p>
                              <p className="text-lg font-black text-[var(--text-primary)]">15</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Tip */}
              <div className="mx-6 p-3 bg-[var(--primary)]/5 border border-[var(--primary)]/10 rounded-2xl">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-bold text-[var(--primary-dark)]">💡 Tip: </span>
                  {tip}
                </p>
              </div>

              {/* CTA */}
              <div className="p-6">
                <motion.button
                  onClick={startBreathing}
                  disabled={isRunning}
                  className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-60 text-white font-bold rounded-2xl shadow-lg shadow-[var(--primary)]/20 transition-all"
                  whileTap={{ scale: 0.97 }}
                >
                  {isRunning ? 'Breathing in progress...' : phase === 'done' ? 'Start Again' : 'Start Breathing Exercise'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Break Recommendation Modal */}
      <AnimatePresence>
        {showBreakModal && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="w-full max-w-xs bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coffee className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Break Recommended</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                You're back online! To stay sharp, we recommend taking a <span className="text-blue-600 font-bold">10-minute break</span> before your first ride of the session.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHasDismissedBreakModal(true);
                  setShowBreakModal(false);
                }}
                className="w-full py-3 bg-[var(--primary)] text-white font-bold rounded-xl shadow-lg shadow-[var(--primary)]/20"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
