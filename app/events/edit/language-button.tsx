import React from 'react';

interface LanguageButtonProps {
  language: 'en' | 'es';
  onLanguageChange: (lang: 'en' | 'es') => void;
  t: {
    [key: string]: {
      [key: string]: string;
    };
  };
}

/**
 * Bold EN/ES segmented toggle for the editor topbar. Sits inline (h-9) with the
 * other header controls — replaces the previous flag emoji.
 */
export const LanguageButton: React.FC<LanguageButtonProps> = ({
  language,
  onLanguageChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Event content language"
      className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
    >
      {(['en', 'es'] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => onLanguageChange(lng)}
          aria-pressed={language === lng}
          className={`h-full px-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
            language === lng
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
};
