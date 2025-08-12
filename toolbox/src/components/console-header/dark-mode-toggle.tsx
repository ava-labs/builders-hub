'use client'

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      // no saved theme and not prefersDark
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('theme');
      if (stored) return; // respect explicit user choice
      if (e.matches) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      } else {
        document.documentElement.classList.remove('dark');
        setIsDark(false);
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    if (typeof document === 'undefined') return;
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-label="Toggle dark mode">
      {isDark ? (
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4" />
          <span className="text-xs">Light</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4" />
          <span className="text-xs">Dark</span>
        </div>
      )}
    </Button>
  );
}

