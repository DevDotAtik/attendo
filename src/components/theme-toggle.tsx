'use client';

import { useTheme } from './theme-provider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-xl bg-teal-50 dark:bg-slate-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-slate-700 transition-colors"
      aria-label="Toggle theme"
      title="Toggle light/dark mode"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
