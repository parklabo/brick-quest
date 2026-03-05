'use client';

import { useTranslations } from 'next-intl';
import { Package } from 'lucide-react';
import { PartsList } from '../../components/inventory/PartsList';

export default function InventoryPage() {
  const t = useTranslations('inventory');

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-8 flex items-center gap-3">
          <Package className="w-8 h-8 text-slate-400" />
          {t('title')}
        </h1>
        <PartsList />
      </div>
    </main>
  );
}
