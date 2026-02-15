'use client';

import { useTranslations } from 'next-intl';
import { PartsList } from '../../components/inventory/PartsList';

export default function InventoryPage() {
  const t = useTranslations('inventory');

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">{t('title')}</h1>
        <p className="text-slate-400 mb-8">{t('description')}</p>
        <PartsList />
      </div>
    </main>
  );
}
