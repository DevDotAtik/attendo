'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QrCode, AlertCircle, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { startRegistration } from '@simplewebauthn/browser';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'STUDENT' ? 'STUDENT' : 'TEACHER';

  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [institution, setInstitution] = useState('');

  const [step, setStep] = useState<'FORM' | 'WEBAUTHN' | 'DONE'>('FORM');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          ...(role === 'STUDENT' ? { rollNo, institution } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (role === 'STUDENT') {
        // Move to WebAuthn Passkey registration step
        setStep('WEBAUTHN');
      } else {
        router.push('/teacher');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Fetch registration options from server
      const optRes = await fetch('/api/webauthn/register/options', { method: 'POST' });
      const options = await optRes.json();

      if (!optRes.ok) {
        throw new Error(options.message || 'Failed to start passkey setup');
      }

      // 2. Prompt client authenticator
      const attResp = await startRegistration(options);

      // 3. Verify attestation response on server
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.message || 'Passkey verification failed');
      }

      setStep('DONE');
      setTimeout(() => {
        router.push('/student');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Passkey enrollment was cancelled or failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-between items-center px-4 sm:px-0 mb-6">
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-teal-600 text-white p-2 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-teal-950 dark:text-teal-100">AttendSheets</span>
          </Link>
          <ThemeToggle />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-teal-950 dark:text-teal-50">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-teal-600 hover:text-teal-500">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-md rounded-2xl border border-teal-100 dark:border-teal-900 sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'FORM' && (
            <form className="space-y-5" onSubmit={handleRegister}>
              {/* Role Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('TEACHER')}
                    className={`py-2.5 text-sm font-semibold rounded-xl border text-center transition-all ${
                      role === 'TEACHER'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Teacher / Faculty
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`py-2.5 text-sm font-semibold rounded-xl border text-center transition-all ${
                      role === 'STUDENT'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Student
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white sm:text-sm"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white sm:text-sm"
                  placeholder="student@university.edu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white sm:text-sm"
                  placeholder="••••••••"
                />
              </div>

              {role === 'STUDENT' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Roll Number / Student ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white sm:text-sm"
                      placeholder="e.g. CS-2024-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Institution / College (Optional)
                    </label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white sm:text-sm"
                      placeholder="e.g. State University"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-all"
              >
                {loading ? 'Creating account...' : role === 'STUDENT' ? 'Continue to Passkey Setup' : 'Create Teacher Account'}
              </button>
            </form>
          )}

          {step === 'WEBAUTHN' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Bind Device Passkey
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                AttendSheets binds one physical phone to your student account using Touch ID, Face ID, or your device PIN.
                This ensures proxy attendance cannot be marked on your behalf.
              </p>
              <button
                onClick={handleRegisterPasskey}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Waiting for biometrics...' : 'Register Device Passkey'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'DONE' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Setup Complete!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your device passkey is bound. Redirecting to student dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-teal-50/50 dark:bg-slate-950">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
