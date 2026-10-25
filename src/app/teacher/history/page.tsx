'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Calendar, FileText } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AttendanceHistoryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">History &amp; Reports</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Monthly Export Card */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" /> Monthly Consolidated Export
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Download CSV report containing all attendance records for the selected month.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white"
            />
            <a
              href={`/api/sessions/export?month=${selectedMonth}`}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Past Sessions</h2>

          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No sessions recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s) => (
                <div key={s.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{s.template?.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(s.startsAt).toLocaleDateString()} at{' '}
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                      {s._count?.records || 0} students
                    </p>
                  </div>
                  <a
                    href={`/api/sessions/${s.id}/export`}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 text-slate-700 dark:text-slate-300 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
