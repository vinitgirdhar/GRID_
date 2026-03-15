import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, Wind, Shield, Coffee, Leaf } from 'lucide-react';
import { cn } from '../lib/utils';

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

export default function SafetyZen() {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<ZenPhase>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [tip] = useState(() => WELLNESS_TIPS[Math.floor(Math.random() * WELLNESS_TIPS.length)]);
  const [driveMinutes, setDriveMinutes] = useState(0);

  // Track drive time (mock — increments every minute the app is open)
  useEffect(() => {
    const timer = setInterval(() => {
      setDriveMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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
          'fixed bottom-40 right-7 md:bottom-24 md:right-9 w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-[60] transition-colors',
          fatigueLevel === 'high'
            ? 'bg-[var(--danger)] text-white animate-pulse'
            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--danger)] hover:bg-red-50'
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        title="Driver Wellness"
      >
        <Heart className="w-5 h-5" />
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
              </div>

              {/* Breathing Orb */}
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="relative flex items-center justify-center w-44 h-44">
                  {/* Pulsing outer rings */}
                  {isRunning && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ background: `radial-gradient(circle, ${orbColor}20, transparent 70%)` }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute inset-4 rounded-full"
                        style={{ background: `radial-gradient(circle, ${orbColor}30, transparent 70%)` }}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.2, 0.7] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                    </>
                  )}
                  {/* Main Orb */}
                  <motion.div
                    className="w-28 h-28 rounded-full flex items-center justify-center shadow-2xl"
                    style={{ background: `radial-gradient(circle at 35% 35%, ${orbColor}dd, ${orbColor}88)` }}
                    animate={{ scale: orbScale }}
                    transition={{ duration: phase === 'inhale' ? 4 : phase === 'exhale' ? 6 : 0.3, ease: 'easeInOut' }}
                  >
                    <Wind className="w-8 h-8 text-white" />
                  </motion.div>
                </div>

                {/* Phase Label */}
                <div className="text-center space-y-1">
                  {phase === 'idle' && !isRunning && (
                    <p className="text-[var(--text-secondary)] text-sm">3 breathing cycles to reset</p>
                  )}
                  {phase === 'done' && (
                    <div className="flex items-center gap-2 text-[var(--success)]">
                      <Leaf size={16} />
                      <p className="text-sm font-bold">Session complete! Great job.</p>
                    </div>
                  )}
                  {isRunning && currentCycle && (
                    <motion.p
                      key={phase}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-base font-bold text-[var(--text-primary)]"
                    >
                      {currentCycle.label}
                    </motion.p>
                  )}
                  {cycleCount > 0 && (
                    <p className="text-xs text-[var(--text-secondary)]">{cycleCount} cycles completed today</p>
                  )}
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
    </>
  );
}
