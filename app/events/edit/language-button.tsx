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

export const LanguageButton: React.FC<LanguageButtonProps> = ({
  language,
  onLanguageChange,
  t,
}) => {
  return (
    <div className="flex justify-end mb-2">
      <button
        onClick={() => onLanguageChange(language === 'en' ? 'es' : 'en')}
        className="text-2xl focus:outline-none cursor-pointer"
        title={language === 'en' ? t[language].switchToSpanish : t[language].switchToEnglish}
      >
        {language === 'en' ? '🇬🇧' : '🇪🇸'}
      </button>
    </div>
  );
}; 