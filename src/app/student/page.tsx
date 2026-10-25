'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QrCode, ShieldCheck, KeyRound, AlertCircle, LogOut, CheckCircle2, Clock } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface StudentData {
  id: string;
  name: string;
  email: string;
  isDeviceBound: boolean;
  studentProfile?: { rollNo: string; institution?: string };
}

interface AttendanceItem {
  id: string;
  status: string;
  flags: string[];
  submittedAt: string;
  distanceM: number;
  session: {
    id: string;
    startsAt: string;
    status: string;
    template: { title: string };
    teacher: { name: string };
  };
}

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [history, setHistory] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const meData = await meRes.json();
        setStudent(meData.user);

        const histRes = await fetch('/api/student/history');
        if (histRes.ok) {
          const histData = await histRes.json();
          setHistory(histData.records || []);
        }

        const resetRes = await fetch('/api/student/device-reset-request');
        if (resetRes.ok) {
          const resetData = await resetRes.json();
          const hasPending = resetData.requests?.some((r: any) => r.status === 'PENDING');
          setResetPending(hasPending);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleRequestReset = async () => {
    if (!confirm('Are you sure you want to request a device passkey reset from your teacher?')) return;
    try {
      const res = await fetch('/api/student/device-reset-request', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResetPending(true);
        setResetMessage('Reset request submitted to your teacher.');
      } else {
        alert(data.message || 'Failed to submit request');
      }
    } catch {
      alert('Error requesting reset');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-teal-600 text-white p-2 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-teal-950 dark:text-teal-100">AttendSheets</span>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Welcome Card */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50">
              Welcome back, {student?.name}!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Roll No: <span className="font-semibold text-teal-700 dark:text-teal-300">{student?.studentProfile?.rollNo || 'N/A'}</span>
              {student?.studentProfile?.institution && ` • ${student.studentProfile.institution}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {student?.isDeviceBound ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Device Passkey Bound
              </span>
            ) : (
              <Link
                href="/register?role=STUDENT"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                <KeyRound className="w-3.5 h-3.5" /> Bind Device Passkey
              </Link>
            )}
          </div>
        </div>

        {/* Primary Action: Big Mobile-First Scan Button */}
        <Link
          href="/scan"
          className="w-full py-6 px-6 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-extrabold text-xl rounded-2xl shadow-lg flex items-center justify-center gap-4 transition-all transform active:scale-[0.99]"
        >
          <div className="p-3 bg-white/20 rounded-xl">
            <QrCode className="w-8 h-8" />
          </div>
          <span>Scan Classroom QR</span>
        </Link>

        {/* Device Reset Request Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Switched to a new phone?</span>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Request a device passkey reset from your teacher to bind a new device.
            </p>
            {resetMessage && <p className="text-emerald-600 text-xs mt-1 font-medium">{resetMessage}</p>}
          </div>
          <button
            onClick={handleRequestReset}
            disabled={resetPending}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {resetPending ? 'Reset Request Pending' : 'Request Device Reset'}
          </button>
        </div>

        {/* Attendance History */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" /> Recent Attendance
          </h2>

          {history.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              No attendance records recorded yet. Scan a classroom board QR to get marked present.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((rec) => (
                <div key={rec.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {rec.session.template.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Teacher: {rec.session.teacher.name} &bull; {new Date(rec.submittedAt).toLocaleDateString()} at{' '}
                      {new Date(rec.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        rec.status === 'PRESENT' || rec.status === 'APPROVED_BY_TEACHER'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : rec.status === 'FLAGGED'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}
                    >
                      {rec.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
