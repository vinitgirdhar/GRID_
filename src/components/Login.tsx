import { FormEvent, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion } from 'motion/react';
import { BarChart3, ChevronRight, Navigation, ShieldCheck } from 'lucide-react';

import { getResolvedApiBaseUrl } from '../services/apiService';
import { useDriverStore } from '../stores/driverStore';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { login, authError } = useDriverStore();
  const [email, setEmail] = useState('driver@grid.local');
  const [password, setPassword] = useState('grid-driver-123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isNativePlatform = Capacitor.isNativePlatform();
  const errorMessage = localError ?? authError;

  async function handleDriverLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    setIsSubmitting(true);
    try {
      await login(email, password);
      onLogin('driver');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const formFields = (
    <>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Email</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)]"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)]"
        />
      </div>
    </>
  );

  if (isNativePlatform) {
    return (
      <div className="relative min-h-screen overflow-hidden text-white font-sans" style={{ background: 'radial-gradient(circle at top left, #fde68a 0%, rgba(245,158,11,0.18) 25%, rgba(15,23,42,1) 70%)' }}>
        {/* Animated Orbs Background */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-[#facc15]/25 blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-[40%] -right-[20%] h-[400px] w-[400px] rounded-full bg-amber-500/15 blur-[100px]" 
        />
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)' }}>
          <div className="w-full max-w-[340px]">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="mb-10 flex flex-col items-center justify-center text-center"
            >
              <div className="relative mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl bg-[#facc15] text-slate-950 shadow-[0_0_40px_rgba(250,204,21,0.4)]">
                <div className="absolute inset-x-0 -top-px mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                <Navigation size={32} strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                GRID Pilot
              </h1>
              <p className="mt-2 text-sm font-medium text-white/50">
                Connected infrastructure driving.
              </p>
            </motion.div>

            <motion.section
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            >
              <form className="space-y-4" onSubmit={handleDriverLogin}>
                <div className="space-y-3">
                  <div className="group relative">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="Driver Email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="peer relative w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm font-medium text-white placeholder-white/30 shadow-inner backdrop-blur-xl outline-none ring-1 ring-transparent transition focus:bg-white/10 focus:ring-[#facc15]/50"
                    />
                  </div>
                  <div className="group relative">
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Access Code"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="peer relative w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm font-medium text-white placeholder-white/30 shadow-inner backdrop-blur-xl outline-none ring-1 ring-transparent transition focus:bg-white/10 focus:ring-[#facc15]/50"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-[13px] font-medium text-red-300 backdrop-blur-md"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[#facc15] px-4 py-[18px] text-sm font-black tracking-wide text-slate-950 shadow-[0_10px_40px_-5px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_15px_40px_-5px_rgba(250,204,21,0.6)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent translate-x-[-100%] transition-transform duration-700 ease-in-out group-hover:translate-x-[100%]" />
                  <span className="relative flex items-center gap-2">
                    {isSubmitting ? 'Authenticating...' : 'Start Shift'}
                    {!isSubmitting && <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />}
                  </span>
                </button>
              </form>
            </motion.section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.2fr_0.8fr] bg-[var(--background)]">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#fde68a_0%,rgba(245,158,11,0.18)_25%,rgba(15,23,42,1)_70%)] p-8 lg:p-14 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#facc15] text-slate-950">
              <Navigation size={20} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-white/60">GRID</p>
              <p className="text-lg font-bold">Android Driver Console</p>
            </div>
          </div>

          <div className="max-w-xl space-y-6 py-16">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-black leading-tight lg:text-6xl"
            >
              Production driver operations, not a browser demo.
            </motion.h1>
            <p className="max-w-lg text-base text-white/72 lg:text-lg">
              Authenticated trip offers, persistent telemetry, local MediaPipe assets, and Android-ready service boundaries are now wired into the app.
            </p>
            <div className="flex flex-wrap gap-3 text-sm font-semibold text-white/80">
              <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2">Foreground drowsiness only for V1</div>
              <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2">Background GPS-ready backend</div>
              <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2">JWT session flow</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur">
              <ShieldCheck className="mb-3 text-[#fde68a]" />
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Security</p>
              <p className="mt-2 text-sm font-semibold">JWT auth with secure token storage hooks.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur">
              <Navigation className="mb-3 text-[#fde68a]" />
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Trips</p>
              <p className="mt-2 text-sm font-semibold">Server-generated offers and persistent trip lifecycle.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur">
              <BarChart3 className="mb-3 text-[#fde68a]" />
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Telemetry</p>
              <p className="mt-2 text-sm font-semibold">Presence and drowsiness events stored for audit.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-md rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Driver Sign In</p>
            <h2 className="text-3xl font-black text-[var(--text-primary)]">Start shift</h2>
            <p className="text-sm text-[var(--text-secondary)]">Use the seeded driver account or switch to admin mode for the legacy analytics console.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleDriverLogin}>
            {formFields}

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-black text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Continue as Driver'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-bold text-[var(--text-primary)]">Seeded credentials</p>
            <p className="mt-1 font-mono text-xs">driver@grid.local / grid-driver-123</p>
            <p className="mt-2 text-[11px]">
              API target: <span className="font-mono">{getResolvedApiBaseUrl()}</span>
            </p>
          </div>

          <button
            onClick={() => onLogin('admin')}
            className="mt-5 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--primary)] hover:bg-[var(--background)]"
          >
            Continue to Admin Demo
          </button>
        </div>
      </section>
    </div>
  );
}
