import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base = 'px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_0_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[2px]';
  const variants = {
    primary: 'bg-lego-red hover:bg-red-700 text-white',
    secondary: 'bg-lego-surface hover:bg-slate-700 text-white border border-lego-border',
    danger: 'bg-red-900 hover:bg-red-800 text-red-300 border border-red-800',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
