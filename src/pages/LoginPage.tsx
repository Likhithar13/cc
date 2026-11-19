import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Droplet,
  KeyRound,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'signin' | 'register' | 'reset';

export function LoginPage() {
  const {
    firebaseUser,
    userProfile,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    registerStaffAccount,
    sendPasswordReset,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    setNotice(null);
    clearAuthError();
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setLocalError(null);
    setNotice(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    setNotice(null);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'register') {
        if (fullName.trim().length < 2) {
          throw new Error('Please enter your full name (at least 2 characters).');
        }
        await registerStaffAccount({
          fullName,
          email,
          password,
        });
      } else {
        await sendPasswordReset(email);
        setNotice(
          'Password reset email sent. Check your inbox and follow the reset link.'
        );
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Authentication error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Only block if an account was explicitly disabled
  if (firebaseUser && userProfile && userProfile.status === 'disabled') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border bg-red-50 border-red-200 text-red-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-slate-900">
                Account Access Disabled
              </h1>
              <p className="text-xs text-slate-500">
                {userProfile.displayName} · {userProfile.email}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            This account has been disabled. Please sign in with another registered account or contact your system administrator.
          </p>

          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const displayedError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12 items-stretch">
      {/* Left Hero Clinical Visual */}
      <div className="hidden lg:flex lg:col-span-6 relative bg-slate-900 overflow-hidden flex-col justify-between p-10">
        <img
          src="/src/assets/images/blood_bank_lab_hero_1795074875373.jpg"
          alt="Clinical blood bank and cold-storage laboratory"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/35" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-700 text-white flex items-center justify-center">
            <Droplet className="w-5 h-5" />
          </div>
          <span className="font-display text-lg font-bold text-white tracking-tight">
            HemoCore Blood Bank
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <h2 className="font-display text-3xl font-bold text-white leading-tight [text-wrap:balance]">
            AI-Enabled Blood Bank Inventory, Donor Operations &amp; Gemini Intelligence
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            Academic CAT-3 prototype hosted on Firebase Spark (zero-billing static SPA) with Firebase Authentication, atomic Firestore stock ledgers across all eight blood groups, and Firebase AI Logic Gemini insights with zero donor PII exposure.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15 text-xs text-slate-200">
            <div>
              <div className="font-mono text-base font-semibold text-white">8 Groups</div>
              <div className="text-slate-300 mt-0.5">Atomic FIFO Stock</div>
            </div>
            <div>
              <div className="font-mono text-base font-semibold text-white">Instant</div>
              <div className="text-slate-300 mt-0.5">Active Demo Access</div>
            </div>
            <div>
              <div className="font-mono text-base font-semibold text-white">Gemini AI</div>
              <div className="text-slate-300 mt-0.5">Anonymized Insights</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Auth Form */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-red-700 text-white flex items-center justify-center">
                <Droplet className="w-4 h-4" />
              </div>
              <span className="font-display text-base font-bold text-slate-900">
                HemoCore
              </span>
            </div>
            <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-red-700" />
              CAT-3 Academic Prototype
            </div>
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {mode === 'signin'
                ? 'Sign in to HemoCore'
                : mode === 'register'
                  ? 'Create Demo Account'
                  : 'Reset Password'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'signin'
                ? 'Access blood inventory, donors, requests, and Gemini AI insights.'
                : mode === 'register'
                  ? 'Register with your name, email, and password to open the dashboard immediately.'
                  : 'Enter your registered email address to receive a password reset link.'}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleModeChange('signin')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('register')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('reset')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'reset'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Forgot Password
            </button>
          </div>

          {displayedError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
              <span>{displayedError}</span>
            </div>
          )}

          {notice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>{notice}</span>
            </div>
          )}

          {mode !== 'reset' && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs text-slate-400">
                  {mode === 'signin' ? 'or sign in with email' : 'or register with email'}
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Ananya Verma"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.edu"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              {submitting
                ? 'Processing...'
                : mode === 'signin'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Register & Open Dashboard'
                    : 'Send Reset Link'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
            Academic demonstration prototype: new accounts activate immediately with sample demonstration data across all eight blood groups.
          </p>
        </div>
      </div>
    </div>
  );
}
