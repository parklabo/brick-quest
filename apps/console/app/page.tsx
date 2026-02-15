'use client';

import { useEffect, useState } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { SHAPE_REGISTRY, ALL_BRICK_SHAPES } from '@brick-quest/shared';
import { Shapes, ScanLine, Hammer, Users, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  color?: string;
}) {
  const content = (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <p className={`text-3xl font-bold ${color ?? 'text-white'}`}>{value}</p>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

interface LiveCounts {
  scans: number | null;
  builds: number | null;
  users: number | null;
}

export default function DashboardPage() {
  const [counts, setCounts] = useState<LiveCounts>({ scans: null, builds: null, users: null });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCounts = async () => {
    setRefreshing(true);
    try {
      const [scansSnap, buildsSnap, usersSnap] = await Promise.all([
        getCountFromServer(query(collection(firestore, 'jobs'), where('type', '==', 'scan'))),
        getCountFromServer(query(collection(firestore, 'jobs'), where('type', '==', 'build'))),
        getCountFromServer(collection(firestore, 'inventories')),
      ]);
      setCounts({
        scans: scansSnap.data().count,
        builds: buildsSnap.data().count,
        users: usersSnap.data().count,
      });
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCounts(); }, []);

  const tier1Count = ALL_BRICK_SHAPES.filter((s) => SHAPE_REGISTRY.get(s)?.tier === 1).length;
  const tier2Count = ALL_BRICK_SHAPES.filter((s) => SHAPE_REGISTRY.get(s)?.tier === 2).length;

  const categories = Array.from(
    new Set(Array.from(SHAPE_REGISTRY.values()).map((d) => d.category)),
  ).sort();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Brick Quest admin overview</p>
        </div>
        <button
          onClick={fetchCounts}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Shapes" value={ALL_BRICK_SHAPES.length} icon={Shapes} href="/shapes" />
        <StatCard label="Tier 1 Shapes" value={tier1Count} icon={Shapes} />
        <StatCard label="Tier 2 Shapes" value={tier2Count} icon={Shapes} />
        <StatCard label="Categories" value={categories.length} icon={Shapes} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Scans" value={counts.scans ?? '--'} icon={ScanLine} href="/scans" />
        <StatCard label="Builds" value={counts.builds ?? '--'} icon={Hammer} href="/stats" />
        <StatCard label="Users" value={counts.users ?? '--'} icon={Users} href="/users" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Shape Registry Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const shapes = Array.from(SHAPE_REGISTRY.values()).filter((d) => d.category === cat);
            return (
              <div key={cat} className="bg-slate-800 rounded-xl p-3">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{cat}</span>
                <p className="text-lg font-bold text-white mt-1">{shapes.length} shapes</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {shapes.map((s) => s.id).join(', ')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
