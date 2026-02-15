'use client';

import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function TagInput({ tags, onTagsChange, label, placeholder, className = '' }: TagInputProps) {
  const t = useTranslations('scanReview');
  const tc = useTranslations('common');
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInput('');
  };

  const handleRemove = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs text-slate-500 font-medium">{label ?? t('tagsOptional')}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder={placeholder ?? t('tagsPlaceholder')}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {tc('add')}
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
              {tag}
              <button type="button" onClick={() => handleRemove(tag)} className="hover:text-blue-200">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
