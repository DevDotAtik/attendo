'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Wifi, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function TrustedIpsPage() {
  const [trustedIps, setTrustedIps] = useState<any[]>([]);
  const [cidr, setCidr] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch('/api/trusted-ips');
    if (res.ok) {
      const data = await res.json();
      setTrustedIps(data.trustedIps || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/trusted-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cidr }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add CIDR');

      setSuccess('Trusted CIDR added successfully');
      setCidr('');
      load();
    } catch (err: any) {
      setError(err.message || 'Error adding CIDR');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/trusted-ips?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        load();
      }
    } catch {
      alert('Failed to delete trusted IP');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">Trusted Campus WiFi IPs</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-teal-600" /> Campus WiFi CIDR Configuration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Students connected to university WiFi will share NAT public IPs. Adding campus CIDR blocks
              prevents legitimate student attendance records from being flagged as <code>SUSPICIOUS_IP</code>.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              required
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="e.g. 192.168.1.0/24 or 10.0.0.0/8"
              className="flex-1 px-3.5 py-2.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add CIDR
            </button>
          </form>

          {/* List */}
          <div className="pt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {trustedIps.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No campus CIDR blocks configured.</p>
            ) : (
              trustedIps.map((tip) => (
                <div key={tip.id} className="py-3 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {tip.cidr}
                  </span>
                  <button
                    onClick={() => handleDelete(tip.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
