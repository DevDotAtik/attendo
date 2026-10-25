'use client';

import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Users, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface BoardState {
  title: string;
  qrUrl: string;
  qrDataUrl: string;
  count: number;
  endsAt: string | null;
  closed: boolean;
  timeLeftSec: number;
}

export default function BoardPage({ params }: { params: { boardToken: string } }) {
  const { boardToken } = params;
  const [state, setState] = useState<BoardState>({
    title: 'Loading Attendance Session...',
    qrUrl: '',
    qrDataUrl: '',
    count: 0,
    endsAt: null,
    closed: false,
    timeLeftSec: 0,
  });

  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let countdownTimer: NodeJS.Timeout;

    function connect() {
      const es = new EventSource(`/api/board/${boardToken}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.addEventListener('qr:update', async (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const qrDataUrl = await QRCode.toDataURL(data.url, {
            width: 480,
            margin: 2,
            color: {
              dark: '#042F2E',
              light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
          });

          setState((prev) => ({
            ...prev,
            title: data.title || prev.title,
            qrUrl: data.url,
            qrDataUrl,
            endsAt: data.endsAt,
            closed: false,
          }));
        } catch (err) {
          console.error('Failed to parse QR update:', err);
        }
      });

      es.addEventListener('count:update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setState((prev) => ({ ...prev, count: data.count }));
        } catch (err) {
          console.error('Failed to parse count update:', err);
        }
      });

      es.addEventListener('session:closed', () => {
        setState((prev) => ({ ...prev, closed: true }));
        es.close();
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Auto-reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    }

    connect();

    // Session countdown timer
    countdownTimer = setInterval(() => {
      setState((prev) => {
        if (!prev.endsAt || prev.closed) return prev;
        const diff = Math.max(0, Math.floor((new Date(prev.endsAt).getTime() - Date.now()) / 1000));
        return {
          ...prev,
          timeLeftSec: diff,
          closed: diff === 0 ? true : prev.closed,
        };
      });
    }, 1000);

    return () => {
      eventSourceRef.current?.close();
      clearInterval(countdownTimer);
    };
  }, [boardToken]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-8 select-none">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-teal-400 animate-ping" />
            <h1 className="text-3xl font-black tracking-tight text-white">{state.title}</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            Live Classroom Attendance &bull; Scan to Mark Present
          </p>
        </div>

        <div className="flex items-center gap-8">
          {/* Live Count */}
          <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-teal-300">{state.count}</div>
              <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">Marked Present</div>
            </div>
          </div>

          {/* Time Remaining */}
          <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-amber-300">
                {state.closed ? '00:00' : formatTime(state.timeLeftSec)}
              </div>
              <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">Time Remaining</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Board Center */}
      <main className="flex-1 flex flex-col items-center justify-center my-6">
        {state.closed ? (
          <div className="bg-slate-900 border-2 border-red-500/40 p-12 rounded-3xl max-w-lg text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl mx-auto flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-3">Attendance Closed</h2>
            <p className="text-slate-400 text-base mb-6">
              This session has concluded. No further attendance submissions can be made.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-teal-300 font-bold">
              Total Recorded: {state.count}
            </div>
          </div>
        ) : state.qrDataUrl ? (
          <div className="flex flex-col items-center">
            {/* Stable Session QR Code */}
            <div className="relative p-6 bg-white rounded-3xl shadow-2xl border-4 border-teal-500/30 flex items-center justify-center">
              <img
                src={state.qrDataUrl}
                alt="Classroom Attendance Session QR"
                className="w-80 h-80 md:w-96 md:h-96 object-contain rounded-xl"
              />
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Scan using phone camera &bull; Location-verified session</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-20">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg">Generating classroom QR...</p>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 pt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {connected ? 'Stream Connected' : 'Connecting to Classroom Stream...'}
        </div>
        <div>Scan using phone camera or AttendSheets scanner &bull; Proxy Protection Active</div>
      </footer>
    </div>
  );
}
