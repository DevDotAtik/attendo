'use client';

import Link from 'next/link';
import { QrCode, ShieldCheck, MapPin, KeyRound, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-teal-600 text-white p-2 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-teal-950 dark:text-teal-100">AttendSheets</span>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-teal-900 dark:text-teal-200 hover:text-teal-700 dark:hover:text-teal-100 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100/80 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Proxy-Resistant Attendance
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-teal-950 dark:text-teal-50 tracking-tight leading-tight md:leading-none mb-6">
            Fair classroom attendance in <span className="text-teal-600 dark:text-teal-400">seconds</span>.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Project a rotating QR code on your classroom board. Students scan, pass cryptographic passkey
            and GPS proximity checks, and get marked in real time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register?role=TEACHER"
              className="w-full sm:w-auto px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              Start as Teacher <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/register?role=STUDENT"
              className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-100 hover:bg-teal-50 dark:hover:bg-slate-700 font-semibold rounded-xl shadow-sm transition-all"
            >
              Join as Student
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-6xl mx-auto px-4 py-16 border-t border-teal-100 dark:border-teal-900">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-teal-100 dark:border-teal-900 shadow-sm">
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-teal-950 dark:text-teal-100 mb-2">10-Second Rotating QR</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Tokens rotate every 10 seconds with single-use nonce verification. Screenshots sent to absent friends expire before they can be opened.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-teal-100 dark:border-teal-900 shadow-sm">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-teal-950 dark:text-teal-100 mb-2">Biometric Passkey Binding</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                One student, one registered device. Cryptographic WebAuthn signatures prevent proxy submissions from other phones or laptops.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-teal-100 dark:border-teal-900 shadow-sm">
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-teal-950 dark:text-teal-100 mb-2">Server-Side GPS Proximity</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                High-accuracy Haversine distance checks ensure physical presence inside the classroom radius without storing raw student coordinates.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-teal-200 dark:border-teal-900 bg-white dark:bg-slate-900 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>&copy; {new Date().getFullYear()} AttendSheets. Cryptographic proxy-resistant classroom attendance.</p>
      </footer>
    </div>
  );
}
