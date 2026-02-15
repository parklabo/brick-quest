'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleLanguageChange = useCallback(
    (newLocale: string) => {
      router.replace(pathname, { locale: newLocale });
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [router, pathname],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % LANGUAGES.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + LANGUAGES.length) % LANGUAGES.length);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0) {
          handleLanguageChange(LANGUAGES[focusedIndex].code);
        }
        break;
      case 'Escape':
        event.preventDefault();
        close();
        buttonRef.current?.focus();
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        onClick={() => {
          setIsOpen(!isOpen);
          setFocusedIndex(-1);
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-colors"
        aria-label="Change language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-5 h-5" />
        <span className="uppercase text-sm font-medium">{locale}</span>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute top-full right-0 mt-2 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
        >
          {LANGUAGES.map((lang, index) => (
            <li
              key={lang.code}
              role="option"
              aria-selected={locale === lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors ${
                focusedIndex === index ? 'bg-slate-800' : ''
              } ${locale === lang.code ? 'text-brand-primary font-bold' : 'text-slate-300'} hover:bg-slate-800`}
            >
              {lang.label}
              {locale === lang.code && <Check className="w-4 h-4" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
