'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  Download,
  StopCircle,
  CheckCircle,
  XCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface LiveRecord {
  id: string;
  status: string;
  flags: string[];
  distanceM: number;
  ip: string;
  submittedAt: string;
  formData: Record<string, any>;
  student?: {
    id: string;
    name: string;
    email: string;
    studentProfile?: { rollNo: string };
  } | null;
}

export default function TeacherLiveSessionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const [records, setRecords] = useState<LiveRecord[]>([]);
  const [count, setCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource(`/api/sessions/${id}/live`);
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);

      es.addEventListener('records:update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setRecords(data.records || []);
          setCount(data.count || 0);
          setFlaggedCount(data.flaggedCount || 0);
          if (data.sessionStatus) {
            setSessionStatus(data.sessionStatus);
          }
        } catch (err) {
          console.error(err);
        }
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [id]);

  const handleOverride = async (recordId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Optimistic local update
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? { ...r, status: action === 'APPROVE' ? 'APPROVED_BY_TEACHER' : 'REJECTED_BY_TEACHER' }
              : r
          )
        );
      }
    } catch {
      alert('Error updating record status');
    }
  };

  const handleCloseSession = async () => {
    if (!confirm('Are you sure you want to end this attendance session? The board QR will immediately stop.'))
      return;
    setClosing(true);
    try {
      const res = await fetch(`/api/sessions/${id}/close`, { method: 'POST' });
      if (res.ok) {
        alert('Session closed successfully');
        router.push('/teacher');
      }
    } catch {
      alert('Error closing session');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  sessionStatus === 'CLOSED'
                    ? 'bg-slate-400'
                    : connected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              {sessionStatus === 'CLOSED' ? 'Session Closed' : 'Live Attendance Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href={`/api/sessions/${id}/export`}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
            {sessionStatus === 'ACTIVE' ? (
              <button
                onClick={handleCloseSession}
                disabled={closing}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow"
              >
                <StopCircle className="w-3.5 h-3.5" /> Close Session
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700">
                Closed
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-50">{count}</div>
              <div className="text-xs uppercase font-semibold text-slate-400">Total Present</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{flaggedCount}</div>
              <div className="text-xs uppercase font-semibold text-slate-400">Flagged For Review</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-5 rounded-2xl shadow-sm flex items-center gap-4 col-span-2 sm:col-span-1">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {count - flaggedCount}
              </div>
              <div className="text-xs uppercase font-semibold text-slate-400">Direct Verified</div>
            </div>
          </div>
        </div>

        {/* Live Attendance Table */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Live Entries</h2>
            <span className="text-xs text-slate-400 font-medium">Auto-updating via SSE</span>
          </div>

          {records.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Waiting for students to scan the board QR and submit attendance...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Roll No</th>
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">Distance</th>
                    <th className="px-6 py-3.5">Status &amp; Flags</th>
                    <th className="px-6 py-3.5">Time</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono font-bold text-teal-700 dark:text-teal-300">
                        {r.student?.studentProfile?.rollNo || r.formData?.rollNo || r.formData?.roll_no || r.formData?.['Roll Number'] || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.student?.name || r.formData?.fullName || r.formData?.name || 'Guest Student'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {r.student?.email || r.formData?.email || 'Direct Scan'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
                        {Math.round(r.distanceM)}m
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            r.status === 'PRESENT' || r.status === 'APPROVED_BY_TEACHER'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : r.status === 'FLAGGED'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {r.status.replace(/_/g, ' ')}
                        </span>
                        {r.flags.length > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-mono">
                            {r.flags.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                        {new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {r.status === 'FLAGGED' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOverride(r.id, 'APPROVE')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOverride(r.id, 'REJECT')}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shadow-sm"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
