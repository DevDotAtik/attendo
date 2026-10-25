'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Check, X, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function DeviceResetsPage() {
  const [requests, setRequests] = useState<any[]>([]);

  const load = async () => {
    const res = await fetch('/api/device-resets');
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/device-resets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        load();
      }
    } catch {
      alert('Error reviewing request');
    }
  };

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
            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">Device Reset Requests</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 rounded-3xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-teal-600" /> Passkey Reset Approvals
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              When a student changes or loses their phone, they submit a reset request. Approving will revoke their previous device credential.
            </p>
          </div>

          {requests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No device reset requests found.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map((req) => (
                <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {req.student.name}{' '}
                      <span className="text-xs font-mono text-teal-600 font-normal">
                        ({req.student.studentProfile?.rollNo || 'No Roll No'})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {req.student.email} &bull; Requested on {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => handleAction(req.id, 'APPROVE')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleAction(req.id, 'REJECT')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {req.status}
                      </span>
                    )}
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
