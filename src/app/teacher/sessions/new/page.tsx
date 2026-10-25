'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Play, Copy, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function StartSessionPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [durationMin, setDurationMin] = useState(5);
  const [radiusM, setRadiusM] = useState(100);

  const [anchorLat, setAnchorLat] = useState<number | null>(null);
  const [anchorLng, setAnchorLng] = useState<number | null>(null);
  const [anchorAccuracy, setAnchorAccuracy] = useState<number | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Result state
  const [sessionResult, setSessionResult] = useState<{
    sessionId: string;
    boardUrl: string;
    boardToken: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        if (data.templates?.length > 0) {
          setSelectedTemplateId(data.templates[0].id);
        }
      }
    }
    load();
    captureTeacherLocation();
  }, []);

  const captureTeacherLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAnchorLat(pos.coords.latitude);
        setAnchorLng(pos.coords.longitude);
        setAnchorAccuracy(pos.coords.accuracy);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setError('Location access denied. High-accuracy GPS is required to anchor the classroom.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (anchorLat === null || anchorLng === null || anchorAccuracy === null) {
      setError('Please capture your classroom GPS anchor first.');
      return;
    }

    if (anchorAccuracy > 50) {
      setError(`GPS accuracy is ${Math.round(anchorAccuracy)}m. It must be 50m or better. Please move near a window and retry.`);
      return;
    }

    setStarting(true);
    setError('');

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          durationMin: Number(durationMin),
          radiusM: Number(radiusM),
          anchorLat,
          anchorLng,
          anchorAccuracy,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start session');

      setSessionResult({
        sessionId: data.session.id,
        boardUrl: data.boardUrl,
        boardToken: data.boardToken,
      });
    } catch (err: any) {
      setError(err.message || 'Error launching session');
    } finally {
      setStarting(false);
    }
  };

  const copyBoardUrl = () => {
    if (!sessionResult) return;
    navigator.clipboard.writeText(sessionResult.boardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">Start Session</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
        {sessionResult ? (
          <div className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 p-8 rounded-3xl shadow-xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-1">
                Attendance Session Launched!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open the board URL on your classroom display screen. Rotating QR will stream automatically.
              </p>
            </div>

            {/* Board Link Input */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl">
              <input
                type="text"
                readOnly
                value={sessionResult.boardUrl}
                className="bg-transparent flex-1 px-3 text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none"
              />
              <button
                onClick={copyBoardUrl}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={sessionResult.boardUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow flex items-center justify-center gap-2"
              >
                Open Classroom Board <ExternalLink className="w-4 h-4" />
              </a>
              <Link
                href={`/teacher/sessions/${sessionResult.sessionId}`}
                className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 font-bold rounded-xl shadow-sm flex items-center justify-center gap-2"
              >
                View Live Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-8 rounded-3xl shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">Session Parameters</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure template, duration, and classroom GPS proximity radius.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-2xl flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleStartSession} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Attendance Template
                </label>
                {templates.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    No templates found. <Link href="/teacher/templates" className="underline font-bold">Create one</Link> first.
                  </p>
                ) : (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({(t.fields as any[])?.length || 0} fields)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Allowed Radius (Meters)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={radiusM}
                    onChange={(e) => setRadiusM(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* GPS Anchor Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <MapPin className="w-4 h-4 text-teal-600" /> Classroom Location Anchor
                  </span>
                  <button
                    type="button"
                    onClick={captureTeacherLocation}
                    disabled={gpsLoading}
                    className="text-xs text-teal-600 hover:underline font-semibold"
                  >
                    {gpsLoading ? 'Detecting...' : 'Re-detect GPS'}
                  </button>
                </div>

                {anchorLat !== null && anchorAccuracy !== null ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                    <p>Anchor: {anchorLat.toFixed(6)}, {anchorLng?.toFixed(6)}</p>
                    <p className={anchorAccuracy > 50 ? 'text-red-500 font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                      GPS Accuracy: {Math.round(anchorAccuracy)}m {anchorAccuracy <= 50 ? '(Acceptable)' : '(Too coarse, must be ≤ 50m)'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Capturing classroom GPS anchor...</p>
                )}
              </div>

              <button
                type="submit"
                disabled={starting || templates.length === 0 || (anchorAccuracy !== null && anchorAccuracy > 50)}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> {starting ? 'Launching...' : 'Start Session & Generate Board QR'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
