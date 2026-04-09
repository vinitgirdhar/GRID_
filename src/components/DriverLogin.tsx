import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Phone, Lock, AlertCircle, Loader2,
    Navigation, User, Car, MapPin, CheckCircle2, Eye, EyeOff,
} from 'lucide-react';
import { Driver } from '../types';
import { loginDriver, registerDriver } from '../services/apiService';
import { initUnicornStudioBackground } from '../lib/unicornStudio';

const NYC_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const CAR_MODELS = [
    'Toyota Camry Hybrid', 'Honda Accord', 'Hyundai Sonata', 'Tesla Model 3',
    'Nissan Altima', 'Toyota RAV4 Hybrid', 'Kia K5', 'Chevrolet Malibu',
];

interface DriverLoginProps {
    onSuccess: (driver: Driver) => void;
    onBack: () => void;
}

/* ─── WebGL Hero Animation from Landing Page ─── */
const HeroAnimation = () => {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div
                data-us-project="WL20Cho3hr5Ge8Pk2QUl"
                data-us-scale="0.75"
                data-us-dpi="1"
                data-us-fps="30"
                data-us-lazyload="true"
                data-us-production="true"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
            {/* Dark overlay to ensure text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#050514]/40 via-transparent to-[#050514]" />
        </div>
    );
};

/* ─── Shared input style ─── */
const inputCls = 'w-full bg-white/5 border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--accent)]/60 focus:ring-1 focus:ring-[var(--accent)]/20 transition-all text-[var(--text)] placeholder:text-[var(--text-muted)] disabled:opacity-50';

const headingFontStyle = { fontFamily: 'var(--font-heading, Outfit, sans-serif)' } as const;
const bodyFontStyle = { fontFamily: 'var(--font-body, Inter, sans-serif)' } as const;
const monoFontStyle = { fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' } as const;

function Field({ label, icon: Icon, error, children }: {
    label: string; icon: React.ElementType; error?: string | null; children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest" style={monoFontStyle}>{label}</label>
            <div className="relative">
                <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                {children}
            </div>
            {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {error}
                </p>
            )}
        </div>
    );
}

/* ─── Custom Select (dark-themed dropdown) ─── */
function CustomSelect({ value, onChange, options, placeholder, icon: Icon, error, disabled }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder: string;
    icon: React.ElementType;
    error?: string | null;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest" style={monoFontStyle}>
                {placeholder.replace('Select ', '').replace('…', '')}
            </label>
            <div ref={ref} className="relative">
                <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen((o) => !o)}
                    className={`${inputCls} text-left flex items-center justify-between pr-9 ${!value ? 'text-[var(--text-muted)]' : ''}`}
                >
                    <span className="truncate">{value || placeholder}</span>
                    <svg
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <AnimatePresence>
                    {open && (
                        <motion.ul
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.12 }}
                            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--border)] bg-[#0e0e24] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
                        >
                            {options.map((opt) => (
                                <li key={opt}>
                                    <button
                                        type="button"
                                        onClick={() => { onChange(opt); setOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100
                                            ${value === opt
                                                ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium'
                                                : 'text-[var(--text)] hover:bg-white/5'
                                            }`}
                                    >
                                        {opt}
                                    </button>
                                </li>
                            ))}
                        </motion.ul>
                    )}
                </AnimatePresence>
            </div>
            {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {error}
                </p>
            )}
        </div>
    );
}

/* ─── Login Form ─── */
function LoginForm({
    onSuccess,
    onGoRegister,
}: {
    key?: React.Key;
    onSuccess: (d: Driver) => void;
    onGoRegister: () => void;
}) {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
            setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            key="login"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 32, mass: 0.9 }}
            className="w-full space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-2xl font-medium text-[var(--text)] tracking-tight" style={headingFontStyle}>Sign in</h2>
                <p className="text-sm text-[var(--text-secondary)]" style={bodyFontStyle}>Welcome back. Enter your details to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <Field label="Phone Number" icon={Phone}>
                    <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                        required
                        disabled={loading}
                        autoComplete="off"
                        className={`${inputCls} font-mono tracking-widest`}
                    />
                </Field>

                <Field label="Password" icon={Lock}>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        autoComplete="new-password"
                        className={`${inputCls} pr-10`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                    >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </Field>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    >
                        <AlertCircle size={15} className="shrink-0" />
                        {error}
                    </motion.div>
                )}

                <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[rgba(250,204,21,0.05)] text-[var(--accent)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.15)] hover:border-[rgba(250,204,21,0.6)] hover:shadow-[0_4px_20px_rgba(250,204,21,0.15)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    style={bodyFontStyle}
                >
                    {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                        : <><Navigation size={16} /> Sign In</>}
                </motion.button>
            </form>

            <p className="text-center text-sm text-[var(--text-secondary)]" style={bodyFontStyle}>
                New to GRID?{' '}
                <button
                    onClick={onGoRegister}
                    className="text-[var(--accent)] hover:text-[var(--accent2)] font-medium transition-colors"
                >
                    Create an account
                </button>
            </p>
        </motion.div>
    );
}

/* ─── Register Form ─── */
function RegisterForm({
    onSuccess,
    onGoLogin,
}: {
    key?: React.Key;
    onSuccess: (d: Driver) => void;
    onGoLogin: () => void;
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
        if (!name.trim() || name.trim().split(' ').length < 2) errs.name = 'Enter full name (first & last).';
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
            key="register"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 32, mass: 0.9 }}
            className="w-full space-y-5"
        >
            <div className="space-y-1">
                <h2 className="text-2xl font-medium text-[var(--text)] tracking-tight" style={headingFontStyle}>Create account</h2>
                <p className="text-sm text-[var(--text-secondary)]" style={bodyFontStyle}>Join thousands of drivers earning on GRID.</p>
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

                <CustomSelect
                    value={borough}
                    onChange={setBorough}
                    options={NYC_BOROUGHS}
                    placeholder="Select borough…"
                    icon={MapPin}
                    error={fieldErrors.borough}
                    disabled={loading}
                />

                <CustomSelect
                    value={carModel}
                    onChange={setCarModel}
                    options={CAR_MODELS}
                    placeholder="Select vehicle…"
                    icon={Car}
                    error={fieldErrors.carModel}
                    disabled={loading}
                />

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    >
                        <AlertCircle size={15} className="shrink-0" />
                        {error}
                    </motion.div>
                )}

                <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[rgba(250,204,21,0.05)] text-[var(--accent)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.15)] hover:border-[rgba(250,204,21,0.6)] hover:shadow-[0_4px_20px_rgba(250,204,21,0.15)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    style={bodyFontStyle}
                >
                    {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                        : <><CheckCircle2 size={16} /> Create Driver Account</>}
                </motion.button>
            </form>

            <p className="text-center text-sm text-[var(--text-secondary)]" style={bodyFontStyle}>
                Already have an account?{' '}
                <button
                    onClick={onGoLogin}
                    className="text-[var(--accent)] hover:text-[var(--accent2)] font-medium transition-colors"
                >
                    Sign in
                </button>
            </p>
        </motion.div>
    );
}

export default function DriverLogin({ onSuccess, onBack }: DriverLoginProps) {
    const [view, setView] = useState<'login' | 'register'>('login');
    React.useEffect(() => {
        void initUnicornStudioBackground();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--bg)]" style={bodyFontStyle}>
            <HeroAnimation />

            {/* Back to landing */}
            <button
                onClick={onBack}
                className="absolute top-6 left-6 flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors z-10 group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Back
            </button>

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                {/* Logo header */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex items-center gap-3 mb-3">
                        <img src="/grid-logo.png" alt="GRID" className="h-12 w-auto object-contain drop-shadow-[0_0_20px_rgba(250,204,21,0.2)]" />
                        <span
                            className="text-2xl tracking-widest"
                            style={{
                                fontFamily: 'var(--font-heading, Outfit, sans-serif)',
                                fontSize: 'clamp(2rem, 6vw, 3rem)',
                                fontWeight: 500,
                                lineHeight: 1,
                                letterSpacing: '-0.01em',
                                textTransform: 'uppercase',
                                background: 'linear-gradient(170deg, #ffffff 40%, #fbbf24 110%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                filter: 'drop-shadow(0 4px 20px rgba(250,204,21,0.2))',
                            }}
                        >
                            GRID
                        </span>
                    </div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.35 }}
                        className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] font-medium"
                        style={monoFontStyle}
                    >
                        Driver Portal
                    </motion.p>
                </motion.div>

                {/* Tab switcher */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                    className="relative flex rounded-xl p-1 mb-6 bg-white/5 border border-[var(--border)]"
                    role="tablist"
                    aria-label="Driver authentication"
                >
                    {/* Sliding indicator */}
                    <motion.div
                        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-[rgba(250,204,21,0.1)] border border-[rgba(250,204,21,0.35)]"
                        animate={{ x: view === 'login' ? 0 : 'calc(100% + 8px)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 35, mass: 0.8 }}
                        style={{ left: 4 }}
                    />
                    <button
                        type="button"
                        onClick={() => setView('login')}
                        role="tab"
                        id="driver-auth-tab-login"
                        aria-selected={view === 'login'}
                        aria-controls="driver-auth-panel"
                        className={`relative flex-1 py-2 rounded-lg text-sm transition-colors duration-200 z-10 ${view === 'login' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                            }`}
                        style={bodyFontStyle}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('register')}
                        role="tab"
                        id="driver-auth-tab-register"
                        aria-selected={view === 'register'}
                        aria-controls="driver-auth-panel"
                        className={`relative flex-1 py-2 rounded-lg text-sm transition-colors duration-200 z-10 ${view === 'register' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                            }`}
                        style={bodyFontStyle}
                    >
                        Sign Up
                    </button>
                </motion.div>

                {/* Form card */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                    className="relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-7"
                    role="tabpanel"
                    id="driver-auth-panel"
                    aria-labelledby={view === 'login' ? 'driver-auth-tab-login' : 'driver-auth-tab-register'}
                    style={{
                        backdropFilter: 'blur(12px)',
                        willChange: 'transform',
                        transform: 'translateZ(0)',
                    }}
                >
                    <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-70" />
                    <AnimatePresence mode="wait" initial={false}>
                        {view === 'login'
                            ? <LoginForm key="login" onSuccess={onSuccess} onGoRegister={() => setView('register')} />
                            : <RegisterForm key="register" onSuccess={onSuccess} onGoLogin={() => setView('login')} />
                        }
                    </AnimatePresence>
                </motion.div>

                <p className="text-center text-xs text-[var(--text-muted)] mt-6" style={bodyFontStyle}>
                    © {new Date().getFullYear()} GRID Mobility. All rights reserved.
                </p>
            </motion.div>
        </div>
    );
}
