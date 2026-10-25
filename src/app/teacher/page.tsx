'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  QrCode,
  PlusCircle,
  FileText,
  Clock,
  ShieldCheck,
  LogOut,
  Users,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function TeacherDashboard() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const meData = await meRes.json();
        if (meData.user.role !== 'TEACHER') {
          router.push('/student');
          return;
        }
        setTeacher(meData.user);

        const sessRes = await fetch('/api/sessions');
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setSessions(sessData.sessions || []);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isSessionActive = (s: any) =>
    s.status === 'ACTIVE' && new Date(s.endsAt) > new Date();

  const activeSessions = sessions.filter(isSessionActive);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-teal-600 text-white p-2 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-teal-950 dark:text-teal-100">AttendSheets</span>
            <span className="text-xs bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded font-semibold ml-2">Faculty</span>
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

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {/* Banner with Actions */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-8 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">
              Welcome, Prof. {teacher?.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Start an attendance session, project the rotating QR to the classroom board, or manage form templates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/teacher/sessions/new"
              className="px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" /> Start Session
            </Link>
            <Link
              href="/teacher/templates"
              className="px-5 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <FileText className="w-5 h-5" /> Form Templates
            </Link>
          </div>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            href="/teacher/history"
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
          >
            History &amp; CSV Exports
          </Link>
          <Link
            href="/teacher/trusted-ips"
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
          >
            Trusted Campus WiFi IPs
          </Link>
          <Link
            href="/teacher/device-resets"
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
          >
            Device Reset Requests
          </Link>
        </div>

        {/* Active Sessions Card */}
        {activeSessions.length > 0 && (
          <div className="bg-teal-50/60 dark:bg-teal-950/30 border-2 border-teal-500/40 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-bold text-lg">
                <span className="w-3 h-3 rounded-full bg-teal-500 animate-ping" />
                Active Classroom Sessions
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {activeSessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 p-5 rounded-2xl flex items-center justify-between shadow-sm"
                >
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{s.template?.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-teal-600" /> {s._count?.records || 0} students marked
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/teacher/sessions/${s.id}`}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow"
                    >
                      Live View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sessions List */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 rounded-3xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" /> Recent Attendance Sessions
          </h2>

          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
              No sessions created yet. Click "Start Session" above to launch your first session.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s) => (
                <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {s.template?.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Started: {new Date(s.startsAt).toLocaleDateString()} at{' '}
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                      {s._count?.records || 0} records
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const isActive = isSessionActive(s);
                      return (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'CLOSED'}
                        </span>
                      );
                    })()}
                    <Link
                      href={`/teacher/sessions/${s.id}`}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400"
                    >
                      View Details &rarr;
                    </Link>
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
