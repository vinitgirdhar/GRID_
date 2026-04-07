import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Navigation, BarChart3, Shield, Zap, Globe, TrendingUp,
  ArrowRight, ArrowLeft, Phone, Lock, AlertCircle, Loader2,
  User, Car, MapPin, CheckCircle2,
} from 'lucide-react';
import { UserRole, Driver } from '../types';
import { loginDriver, registerDriver } from '../services/apiService';

interface LoginProps {
  onLogin: (role: UserRole, driver?: Driver) => void;
}

const NYC_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const CAR_MODELS = [
  'Toyota Camry Hybrid',
  'Honda Accord',
  'Hyundai Sonata',
  'Tesla Model 3',
  'Nissan Altima',
  'Toyota RAV4 Hybrid',
  'Kia K5',
  'Chevrolet Malibu',
];

/* ─── Animated grid background for the branding panel ─── */
const GridBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#0c1222] via-[#111827] to-[#0f172a]" />
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: `linear-gradient(rgba(250,204,21,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,0.4) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}
    />
    <motion.div
      animate={{ opacity: [0.15, 0.35, 0.15] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute top-[20%] left-[10%] w-[80%] h-[60%]"
    >
      <svg viewBox="0 0 400 300" className="w-full h-full" fill="none">
        <motion.path
          d="M 50 250 Q 100 100 200 150 T 350 80"
          stroke="rgba(250,204,21,0.3)"
          strokeWidth="2"
          strokeDasharray="8 6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M 30 80 Q 150 200 250 120 T 380 200"
          stroke="rgba(250,204,21,0.2)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 4, delay: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.circle cx="200" cy="150" r="4" fill="rgba(250,204,21,0.5)"
          animate={{ r: [3, 6, 3], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.circle cx="100" cy="80" r="3" fill="rgba(250,204,21,0.4)"
          animate={{ r: [2, 5, 2], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, delay: 0.5, repeat: Infinity }}
        />
        <motion.circle cx="320" cy="120" r="3" fill="rgba(250,204,21,0.4)"
          animate={{ r: [2, 5, 2], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, delay: 1, repeat: Infinity }}
        />
      </svg>
    </motion.div>
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#facc15]/5 blur-[120px] rounded-full" />
  </div>
);

const FeaturePill = ({ icon: Icon, text, delay }: { icon: React.ElementType; text: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="flex items-center justify-center sm:justify-start gap-2.5 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm min-w-0"
  >
    <Icon size={14} className="text-[#facc15]" />
    <span className="text-xs font-medium text-white/70">{text}</span>
  </motion.div>
);

/* ─── Input field helper ─── */
function Field({
  label, icon: Icon, error, children,
}: {
  label: string;
  icon: React.ElementType;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-10 pointer-events-none" />
        {children}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--primary)]/60 focus:ring-1 focus:ring-[var(--primary)]/30 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60';

/* ─── Driver Login Form ─── */
function DriverLoginForm({
  onBack,
  onSuccess,
  onRegister,
}: {
  onBack: () => void;
  onSuccess: (driver: Driver) => void;
  onRegister: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const driver = await loginDriver(phone, password);
      onSuccess(driver);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Demo API could not be reached.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key="driver-form"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md space-y-8 relative z-10"
    >
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3 mb-1">
          <img src="/grid-logo.png" alt="GRID" className="h-14 w-auto object-contain" />
          <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Driver Login</h2>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">Enter your phone number and password.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <Field label="Phone Number" icon={Phone}>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Phone number"
            autoComplete="off"
            name="grid-driver-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            maxLength={10}
            required
            disabled={loading}
            className={`${inputCls} font-mono tracking-widest`}
          />
        </Field>

        <Field label="Password" icon={Lock}>
          <input
            type="password"
            placeholder="••••••"
            autoComplete="new-password"
            name="grid-driver-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className={inputCls}
          />
        </Field>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
          >
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </motion.div>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[var(--primary)] text-[#0f172a] font-bold text-sm shadow-lg shadow-[var(--primary)]/20 hover:shadow-xl hover:shadow-[var(--primary)]/30 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : <><Navigation size={16} /> Sign In</>}
        </motion.button>
      </form>
    </motion.div>
  );
}

/* ─── Driver Registration Form ─── */
function DriverRegisterForm({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (driver: Driver) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [borough, setBorough] = useState('');
  const [carModel, setCarModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().split(' ').length < 2) errs.name = 'Enter your full name (first and last).';
    if (phone.length !== 10) errs.phone = 'Must be exactly 10 digits.';
    if (password.length < 6) errs.password = 'At least 6 characters.';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    if (!borough) errs.borough = 'Select your home borough.';
    if (!carModel) errs.carModel = 'Select your vehicle.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const driver = await registerDriver({ name: name.trim(), phone, password, borough, carModel });
      onSuccess(driver);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key="register-form"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md relative z-10"
    >
      <div className="space-y-2 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to login
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Join as a Driver</h2>
            <p className="text-[var(--text-secondary)] text-sm">Create your GRID account in seconds.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
        <Field label="Full Name" icon={User} error={fieldErrors.name}>
          <input
            type="text"
            placeholder="e.g. Alex Thompson"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            className={inputCls}
          />
        </Field>

        <Field label="Phone Number" icon={Phone} error={fieldErrors.phone}>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            maxLength={10}
            required
            disabled={loading}
            className={`${inputCls} font-mono tracking-widest`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" icon={Lock} error={fieldErrors.password}>
            <input
              type="password"
              placeholder="Min 6 chars"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className={inputCls}
            />
          </Field>
          <Field label="Confirm" icon={Lock} error={fieldErrors.confirmPassword}>
            <input
              type="password"
              placeholder="Repeat"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Home Borough" icon={MapPin} error={fieldErrors.borough}>
          <select
            value={borough}
            onChange={(e) => setBorough(e.target.value)}
            required
            disabled={loading}
            className={`${inputCls} appearance-none`}
          >
            <option value="">Select borough…</option>
            {NYC_BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="Vehicle" icon={Car} error={fieldErrors.carModel}>
          <select
            value={carModel}
            onChange={(e) => setCarModel(e.target.value)}
            required
            disabled={loading}
            className={`${inputCls} appearance-none`}
          >
            <option value="">Select vehicle…</option>
            {CAR_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
          >
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </motion.div>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[var(--primary)] text-[#0f172a] font-bold text-sm shadow-lg shadow-[var(--primary)]/20 hover:shadow-xl hover:shadow-[var(--primary)]/30 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
            : <><CheckCircle2 size={16} /> Create Driver Account</>}
        </motion.button>
      </form>
    </motion.div>
  );
}

/* ─── Role selector (desktop left / mobile bottom sheet) ─── */
function RoleSelector({
  onDriverLogin,
  onAdmin,
}: {
  onDriverLogin: () => void;
  onAdmin: () => void;
}) {
  return (
    <motion.div
      key="select"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md space-y-6 sm:space-y-8 relative z-10"
    >
      <div className="space-y-1">
        <img src="/grid-logo.png" alt="GRID" className="h-10 w-auto object-contain mb-3" />
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">Welcome to GRID</h2>
        <p className="text-[var(--text-secondary)] text-sm">Select your role to continue.</p>
      </div>

      <div className="space-y-3">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onDriverLogin}
          className="group w-full flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--primary)] transition-all duration-300">
            <Navigation size={20} className="text-[var(--primary)] group-hover:text-[#0f172a] transition-colors duration-300" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-[var(--primary-dark)] transition-colors">Driver Login</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Sign in with your credentials</p>
          </div>
          <ArrowRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all duration-300" />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onAdmin}
          className="group w-full flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--primary)] transition-all duration-300">
            <BarChart3 size={20} className="text-[var(--primary)] group-hover:text-[#0f172a] transition-colors duration-300" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-[var(--primary-dark)] transition-colors">Admin Access</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage fleet and analytics</p>
          </div>
          <ArrowRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all duration-300" />
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="pt-4 border-t border-[var(--border)] flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />
          <span className="text-xs text-[var(--text-muted)] font-medium">All systems operational</span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">v2.0</span>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Login Component ─── */
export default function Login({ onLogin }: LoginProps) {
  type Step = 'select' | 'driver-login' | 'driver-register';
  const [step, setStep] = useState<Step>('select');

  const handleDriverSuccess = (driver: Driver) => onLogin('driver', driver);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--background)]">

      <div className="relative lg:flex-[3] flex flex-col justify-between overflow-hidden
                      pt-8 pb-16 px-5 sm:p-10
                      lg:min-h-screen lg:p-16">
        <GridBackground />

        <div className="relative z-10 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <img src="/grid-logo.png" alt="GRID" className="h-24 sm:h-32 w-auto object-contain drop-shadow-[0_0_30px_rgba(250,204,21,0.15)]" />
              <div className="h-12 w-px bg-white/10 hidden sm:block" />
              <div className="hidden sm:block">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-widest leading-none">GRID</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1 h-1 bg-[#facc15] rounded-full animate-pulse" />
                  <p className="text-white/30 text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.2em]">Urban Intelligence</p>
                </div>
              </div>
            </div>
            <div className="w-8 h-1 bg-gradient-to-r from-[#facc15] to-transparent rounded-full ml-0.5 opacity-40" />
          </motion.div>
        </div>

        <div className="relative z-10 mt-16 sm:mt-24 lg:my-auto lg:py-0 flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="space-y-4 sm:space-y-6 max-w-lg"
          >
            <h1 className="text-[2.5rem] leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white tracking-tight">
              The OS for <br className="lg:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#facc15] via-[#fbbf24] to-[#f59e0b]">
                Modern Mobility
              </span>
            </h1>
            <p className="text-sm sm:text-base lg:text-xl text-white/50 leading-relaxed max-w-[300px] sm:max-w-md font-medium">
              Command your fleet. Empower your drivers. <br className="hidden sm:block" />
              Predict demand before it happens.
            </p>
          </motion.div>

          {/* Markers */}
          <div className="grid grid-cols-2 gap-3 mt-10 sm:flex sm:gap-3 sm:overflow-x-auto sm:pb-1 lg:flex-wrap lg:overflow-visible no-scrollbar max-w-md">
            <FeaturePill icon={Globe} text="Live Fleet" delay={0.5} />
            <FeaturePill icon={TrendingUp} text="Demand AI" delay={0.6} />
            <FeaturePill icon={Shield} text="Safety" delay={0.7} />
            <FeaturePill icon={Zap} text="Real-time" delay={0.8} />
          </div>

          {/* Mobile Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="grid grid-cols-3 gap-2 mt-8 max-w-md lg:hidden"
          >
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm px-3 py-4 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-white tracking-tight">1.2M+</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40 mt-1">Rides</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm px-3 py-4 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-white tracking-tight">99.9%</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40 mt-1">Uptime</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm px-3 py-4 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-white tracking-tight">24/7</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40 mt-1">Support</p>
            </div>
          </motion.div>

          {/* Driver CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="relative z-10 mt-10 sm:mt-12 lg:mt-20 group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#facc15]/20 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-3xl" />
            <div className="relative flex items-center gap-5 lg:gap-6 p-5 lg:p-7 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md hover:border-[#facc15]/40 hover:bg-white/[0.08] transition-all duration-500 max-w-sm lg:max-w-lg cursor-pointer shadow-[0_12px_48px_rgba(0,0,0,0.15)]"
                 onClick={() => setStep('driver-register')}>
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-[#facc15]/15 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 border border-[#facc15]/20 shadow-inner">
                 <div className="relative">
                    <Car size={28} className="text-[#facc15] lg:w-9 lg:h-9" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 lg:w-4 lg:h-4 bg-green-500 rounded-full border-2 border-[#0c1222] animate-pulse shadow-sm" />
                 </div>
              </div>
              <div className="space-y-1.5 lg:space-y-2 flex-1">
                <h3 className="text-white font-bold text-base lg:text-xl tracking-tight">Become a Grid Driver</h3>
                <p className="text-white/40 text-[11px] lg:text-sm leading-relaxed hidden sm:block">
                  Join 1,000+ top-rated drivers earning on the grid. <br />
                  Dynamic matching & instant payouts with zero fees.
                </p>
                <div className="flex items-center justify-between mt-2 lg:mt-3">
                  <span className="text-[#facc15] font-extrabold text-xs lg:text-base flex items-center gap-2 group-hover:gap-3 transition-all">
                    Start Registration
                    <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowRight size={18} />
                    </motion.div>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="hidden lg:flex relative z-10 items-center gap-10 text-white/30 text-xs font-medium mt-12"
        >
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-black text-white/90 tracking-tighter">1.2M+</span>
            <span className="uppercase tracking-[0.1em] text-[10px]">Rides Managed</span>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-black text-white/90 tracking-tighter">99.9%</span>
            <span className="uppercase tracking-[0.1em] text-[10px]">Uptime SLA</span>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-black text-white/90 tracking-tighter">24/7</span>
            <span className="uppercase tracking-[0.1em] text-[10px]">Live Support</span>
          </div>
        </motion.div>

      </div>

      {/* Auth Panel - Bottom Sheet on Mobile */}
      <div className="flex-1 lg:flex-[2] bg-[var(--background)] flex items-start lg:items-center justify-center
                      px-4 pb-8 -mt-6 sm:-mt-10 lg:mt-0 lg:p-16
                      relative z-20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_-8px_40px_rgba(0,0,0,0.4)] sm:shadow-[0_18px_50px_rgba(0,0,0,0.3)] p-6 sm:p-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:p-0">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <React.Fragment key="select">
                <RoleSelector
                  onDriverLogin={() => setStep('driver-login')}
                  onAdmin={() => onLogin('admin')}
                />
              </React.Fragment>
            )}
            {step === 'driver-login' && (
              <React.Fragment key="driver-login">
                <DriverLoginForm
                  onBack={() => setStep('select')}
                  onSuccess={handleDriverSuccess}
                  onRegister={() => setStep('driver-register')}
                />
              </React.Fragment>
            )}
            {step === 'driver-register' && (
              <React.Fragment key="driver-register">
                <DriverRegisterForm
                  onBack={() => setStep('driver-login')}
                  onSuccess={handleDriverSuccess}
                />
              </React.Fragment>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
