import { AlertCircle } from 'lucide-react';

export function ErrorAlert({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-3 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-sm text-red-400">{error}</p>
    </div>
  );
}
