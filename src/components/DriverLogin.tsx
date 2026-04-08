import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Phone, Lock, AlertCircle, Loader2,
    Navigation, User, Car, MapPin, CheckCircle2, Eye, EyeOff,
} from 'lucide-react';
import { Driver } from '../types';
import { loginDriver, registerDriver } from '../services/apiService';

const NYC_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const CAR_MODELS = [
    'Toyota Camry Hybrid', 'Honda Accord', 'Hyundai Sonata', 'Tesla Model 3',
    'Nissan Altima', 'Toyota RAV4 Hybrid', 'Kia K5', 'Chevrolet Malibu',
];

interface DriverLoginProps {
    onSuccess: (driver: Driver) => void;
    onBack: () => void;
}

/* ─── Shared input style ─── */
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/20 transition-all text-white placeholder:text-white/30 disabled:opacity-50';

function Field({ label, icon: Icon, error, children }: {
    label: string; icon: React.ElementType; error?: string | null; children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">{label}</label>
            <div className="relative">
                <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none z-10" />
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

/* ─── Login Form ─── */
function LoginForm({ onSuccess, onGoRegister }: { onSuccess: (d: Driver) => void; onGoRegister: () => void }) {
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
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28 }}
            className="w-full space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">Sign in</h2>
                <p className="text-sm text-white/40">Welcome back. Enter your details to continue.</p>
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
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
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#facc15] text-[#0f172a] font-bold text-sm hover:bg-[#fde047] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#facc15]/10 mt-2"
                >
                    {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                        : <><Navigation size={16} /> Sign In</>}
                </motion.button>
            </form>

            <p className="text-center text-sm text-white/30">
                New to GRID?{' '}
                <button
                    onClick={onGoRegister}
                    className="text-[#facc15]/80 hover:text-[#facc15] font-semibold transition-colors"
                >
                    Create an account
                </button>
            </p>
        </motion.div>
    );
}

/* ─── Register Form ─── */
function RegisterForm({ onSuccess, onGoLogin }: { onSuccess: (d: Driver) => void; onGoLogin: () => void }) {
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

    const selectCls = `${inputCls} appearance-none`;

    return (
        <motion.div
            key="register"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28 }}
            className="w-full space-y-5"
        >
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">Create account</h2>
                <p className="text-sm text-white/40">Join thousands of drivers earning on GRID.</p>
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
                        className={selectCls}
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
                        className={selectCls}
                    >
                        <option value="">Select vehicle…</option>
                        {CAR_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
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
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#facc15] text-[#0f172a] font-bold text-sm hover:bg-[#fde047] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#facc15]/10 mt-1"
                >
                    {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                        : <><CheckCircle2 size={16} /> Create Driver Account</>}
                </motion.button>
            </form>

            <p className="text-center text-sm text-white/30">
                Already have an account?{' '}
                <button
                    onClick={onGoLogin}
                    className="text-[#facc15]/80 hover:text-[#facc15] font-semibold transition-colors"
                >
                    Sign in
                </button>
            </p>
        </motion.div>
    );
}

/* ─── Main DriverLogin Component ─── */
export default function DriverLogin({ onSuccess, onBack }: DriverLoginProps) {
    const [view, setView] = useState<'login' | 'register'>('login');

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: '#050514' }}
        >
            {/* Background grid + glow */}
            <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage: `linear-gradient(rgba(250,204,21,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,0.5) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px',
                }}
            />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
                style={{ background: 'radial-gradient(ellipse, rgba(250,204,21,0.06) 0%, transparent 70%)' }}
            />

            {/* Back to landing */}
            <button
                onClick={onBack}
                className="absolute top-6 left-6 flex items-center gap-2 text-sm text-white/30 hover:text-white/70 transition-colors z-10 group"
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
                            className="text-2xl font-black tracking-widest"
                            style={{
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: 'clamp(2rem, 6vw, 3rem)',
                                fontWeight: 600,
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
                        className="text-xs text-white/25 uppercase tracking-[0.2em] font-medium"
                    >
                        Driver Portal
                    </motion.p>
                </motion.div>

                {/* Tab switcher */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                    className="flex rounded-xl p-1 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                        onClick={() => setView('login')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            view === 'login'
                                ? 'bg-[#facc15] text-[#0f172a] shadow-sm'
                                : 'text-white/40 hover:text-white/70'
                        }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setView('register')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            view === 'register'
                                ? 'bg-[#facc15] text-[#0f172a] shadow-sm'
                                : 'text-white/40 hover:text-white/70'
                        }`}
                    >
                        Sign Up
                    </button>
                </motion.div>

                {/* Form card */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                    className="rounded-2xl p-7"
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(250,204,21,0.1)',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <AnimatePresence mode="wait">
                        {view === 'login' ? (
                            <React.Fragment key="login">
                                <LoginForm
                                    onSuccess={onSuccess}
                                    onGoRegister={() => setView('register')}
                                />
                            </React.Fragment>
                        ) : (
                            <React.Fragment key="register">
                                <RegisterForm
                                    onSuccess={onSuccess}
                                    onGoLogin={() => setView('login')}
                                />
                            </React.Fragment>
                        )}
                    </AnimatePresence>
                </motion.div>

                <p className="text-center text-xs text-white/15 mt-6">
                    © {new Date().getFullYear()} GRID Mobility. All rights reserved.
                </p>
            </motion.div>
        </div>
    );
}
