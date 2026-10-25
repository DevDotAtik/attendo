'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { startAuthentication } from '@simplewebauthn/browser';

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'checkbox';
  required: boolean;
  options?: string[];
}

interface CheckResponse {
  checkPassToken: string;
  webauthnChallenge: any;
  deviceToken?: string;
  formSchema: FormField[];
  sessionTitle: string;
  distanceM: number;
  locationDenied?: boolean;
}

function getDeviceToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('attendo_device_token');
  if (!token) {
    token = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('attendo_device_token', token);
  }
  return token;
}

export default function StudentAttendancePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const router = useRouter();

  const [step, setStep] = useState<
    'CHECKING_LOCATION' | 'FORM' | 'SUBMITTING' | 'SUCCESS' | 'ERROR'
  >('CHECKING_LOCATION');

  const [checkData, setCheckData] = useState<CheckResponse | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [locationReason, setLocationReason] = useState<string>('');
  const [submissionStatus, setSubmissionStatus] = useState<string>('');

  const sendCheckRequest = async (bodyPayload: any) => {
    try {
      const devToken = getDeviceToken();
      const res = await fetch('/api/attendance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceToken: devToken,
          ...bodyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorCode(data.error || 'CHECK_FAILED');
        setErrorMessage(data.message || 'Location verification failed.');
        setStep('ERROR');
        return;
      }

      if (data.deviceToken && typeof window !== 'undefined') {
        localStorage.setItem('attendo_device_token', data.deviceToken);
      }

      setCheckData(data);
      const initial: Record<string, any> = {};
      data.formSchema.forEach((f: FormField) => {
        initial[f.name] = f.type === 'checkbox' ? false : '';
      });
      setFormData(initial);
      setStep('FORM');
    } catch {
      setErrorCode('NETWORK_ERROR');
      setErrorMessage('Failed to connect to attendance server. Please try again.');
      setStep('ERROR');
    }
  };

  const proceedWithoutLocation = async (reason?: string) => {
    setStep('CHECKING_LOCATION');
    setErrorMessage('');
    if (reason) setLocationReason(reason);
    await sendCheckRequest({ qrToken: token, locationDenied: true });
  };

  const runLocationCheck = async () => {
    setStep('CHECKING_LOCATION');
    setErrorMessage('');

    if (!navigator.geolocation) {
      await proceedWithoutLocation('Geolocation is not supported by your browser.');
      return;
    }

    const isSecure = typeof window !== 'undefined' ? window.isSecureContext : true;
    let failureReason = '';
    if (!isSecure) {
      failureReason = 'Browser blocked GPS: Insecure HTTP connection. Mobile browsers require HTTPS for geolocation on LAN/public networks.';
    }

    const getPosition = (highAccuracy: boolean, timeoutMs: number) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: highAccuracy ? 0 : 30000,
        });
      });
    };

    let pos1: GeolocationPosition | null = null;

    try {
      // 1. First attempt: high accuracy (GPS)
      pos1 = await getPosition(true, 7000);
    } catch (err: any) {
      console.warn('[High-accuracy Geolocation failed]:', err);
      if (err?.code === 1) {
        failureReason = failureReason || 'Location permission was denied in your browser settings. Please allow location for this site.';
      } else {
        // 2. Second attempt: standard accuracy fallback (Wi-Fi/cellular networks for indoor fixes)
        try {
          pos1 = await getPosition(false, 5000);
        } catch (fallbackErr: any) {
          console.warn('[Standard Geolocation fallback failed]:', fallbackErr);
          if (fallbackErr?.code === 1) {
            failureReason = failureReason || 'Location permission was denied in your browser settings.';
          } else if (fallbackErr?.code === 2) {
            failureReason = 'Location unavailable: Make sure device Location/GPS is toggled ON in quick settings.';
          } else if (fallbackErr?.code === 3) {
            failureReason = 'Location timed out: Unable to acquire GPS or network position fix.';
          } else {
            failureReason = fallbackErr?.message || 'Location access failed.';
          }
        }
      }
    }

    if (!pos1) {
      await proceedWithoutLocation(failureReason);
      return;
    }

    try {
      const reading1 = {
        latitude: pos1.coords.latitude,
        longitude: pos1.coords.longitude,
        accuracy: pos1.coords.accuracy,
        timestamp: pos1.timestamp,
      };

      await new Promise((r) => setTimeout(r, 600));

      const pos2 = await getPosition(false, 3000).catch(() => pos1!);

      const reading2 = {
        latitude: pos2.coords.latitude,
        longitude: pos2.coords.longitude,
        accuracy: pos2.coords.accuracy,
        timestamp: pos2.timestamp,
      };

      await sendCheckRequest({
        qrToken: token,
        reading1,
        reading2,
      });
    } catch (err: any) {
      console.warn('[Geolocation Finalizing Error]:', err);
      await proceedWithoutLocation(err?.message || failureReason);
    }
  };

  useEffect(() => {
    runLocationCheck();
  }, [token]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkData) return;

    setStep('SUBMITTING');
    setErrorMessage('');

    try {
      let webauthnAssertion: any = null;

      // Prompt Biometric Passkey signature if supported in this environment
      if (
        checkData.webauthnChallenge &&
        typeof window !== 'undefined' &&
        window.isSecureContext &&
        window.PublicKeyCredential
      ) {
        try {
          webauthnAssertion = await startAuthentication(checkData.webauthnChallenge);
        } catch (err: any) {
          console.warn('[Passkey Notice]:', err);
        }
      }

      // Submit to /api/attendance/submit
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkPassToken: checkData.checkPassToken,
          formData,
          webauthnAssertion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.error || 'SUBMIT_FAILED');
        throw new Error(data.message || 'Submission failed');
      }

      setSubmissionStatus(data.record.status);
      setStep('SUCCESS');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit attendance');
      setStep('ERROR');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="max-w-md mx-auto w-full mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <div className="max-w-md mx-auto w-full">
        {/* Automatic Location Check Screen */}
        {step === 'CHECKING_LOCATION' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-teal-100 dark:border-teal-900 text-center animate-fade-in">
            <div className="w-16 h-16 bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-2">
              Verifying Classroom Location
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
              Checking your location to confirm physical attendance in the classroom...
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Awaiting GPS signal
              </span>
            </div>
            <button
              type="button"
              onClick={proceedWithoutLocation}
              className="text-xs text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 underline transition-colors"
            >
              Taking long? Continue without GPS (Flagged for review)
            </button>
          </div>
        )}

        {/* Step 3: Dynamic Form */}
        {step === 'FORM' && checkData && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-teal-100 dark:border-teal-900">
            {checkData.locationDenied && (
              <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Location Flagged for Review</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {locationReason || 'Location permission was denied or timed out. Your attendance will be submitted and flagged for teacher review.'}
                </p>
                {typeof window !== 'undefined' && !window.isSecureContext && (
                  <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/30 p-2 rounded-lg font-mono">
                    Note: Mobile browsers block GPS over HTTP (http://...). To allow GPS from your phone, run with HTTPS or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure.
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  {checkData.sessionTitle}
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  Attendance Form
                </h2>
              </div>
              {checkData.locationDenied ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <AlertCircle className="w-3 h-3" /> No GPS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <MapPin className="w-3 h-3" /> {Math.round(checkData.distanceM)}m away
                </span>
              )}
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {checkData.formSchema.map((field) => (
                <div key={field.id}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === 'text' && (
                    <input
                      type="text"
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white"
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white"
                    />
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Select option...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'checkbox' && (
                    <label className="inline-flex items-center gap-2 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={!!formData[field.name]}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
                    </label>
                  )}
                </div>
              ))}

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Submit Attendance
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4: Submitting Attendance */}
        {step === 'SUBMITTING' && (
          <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-teal-100 dark:border-teal-900 text-center animate-fade-in">
            <div className="w-16 h-16 bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Submitting Attendance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verifying your unique device token and recording attendance...
            </p>
          </div>
        )}

        {/* Step 5: Success Screen */}
        {step === 'SUCCESS' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-teal-100 dark:border-teal-900 text-center animate-fade-in">
            {submissionStatus === 'FLAGGED' ? (
              <>
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-2">
                  Attendance Flagged
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                  Your attendance was recorded, but flagged for teacher review due to location or network signals.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-2">
                  Attendance Marked!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                  Your attendance and unique device token have been verified and recorded.
                </p>
              </>
            )}

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-6 text-left text-xs space-y-1.5">
              <div className="font-semibold text-slate-700 dark:text-slate-300">Submitted Information:</div>
              {Object.entries(formData).map(([k, v]) => (
                <div key={k} className="flex justify-between text-slate-500">
                  <span className="capitalize">{k}:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{String(v)}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              You can now safely close this browser window.
            </p>
          </div>
        )}

        {/* Error Screen with Explanations */}
        {step === 'ERROR' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-red-100 dark:border-red-900/50 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              {errorCode === 'OUT_OF_RANGE'
                ? 'Out of Classroom Range'
                : errorCode === 'QR_EXPIRED'
                ? 'QR Code Expired'
                : errorCode === 'ALREADY_MARKED'
                ? 'Already Recorded on this Device'
                : errorCode === 'ROLL_ALREADY_MARKED'
                ? 'Roll Number Already Submitted'
                : errorCode === 'LOW_GPS_ACCURACY'
                ? 'Inaccurate Location'
                : 'Verification Failed'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {errorMessage}
            </p>

            <div className="flex flex-col gap-2.5">
              {errorCode !== 'ALREADY_MARKED' && errorCode !== 'ROLL_ALREADY_MARKED' && (
                <button
                  onClick={runLocationCheck}
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
              )}
              {errorCode !== 'QR_EXPIRED' && errorCode !== 'ALREADY_MARKED' && errorCode !== 'ROLL_ALREADY_MARKED' && (
                <button
                  type="button"
                  onClick={proceedWithoutLocation}
                  className="w-full py-2.5 px-4 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl transition-colors"
                >
                  Continue without location (Submit for review)
                </button>
              )}
              <Link
                href="/scan"
                className="w-full py-2.5 text-xs text-slate-600 dark:text-slate-400 hover:underline"
              >
                Scan a new QR code
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
