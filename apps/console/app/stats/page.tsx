'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Hammer } from 'lucide-react';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { STATUS_COLOR } from '../../lib/constants';

interface BuildJob {
  id: string;
  status: string;
  createdAt: string | null;
  title: string | null;
  stepCount: number | null;
  difficulty: string | null;
}

export default function StatsPage() {
  const [builds, setBuilds] = useState<BuildJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuilds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(
          collection(firestore, 'jobs'),
          where('type', '==', 'build'),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      );
      const data = snap.docs.map((doc) => {
        const d = doc.data();
        const result = d.result;
        return {
          id: doc.id,
          status: d.status ?? 'unknown',
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
          title: result?.title ?? null,
          stepCount: result?.steps?.length ?? null,
          difficulty: d.difficulty ?? null,
        };
      });
      setBuilds(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch builds';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBuilds(); }, [fetchBuilds]);

  const completedBuilds = builds.filter((b) => b.status === 'completed');
  const avgSteps = completedBuilds.length > 0
    ? Math.round(completedBuilds.reduce((sum, b) => sum + (b.stepCount ?? 0), 0) / completedBuilds.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Build Statistics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {!loading && !error && `${builds.length} build jobs`}
            {(loading || error) && 'Build plan generation history'}
          </p>
        </div>
        <RefreshButton onClick={fetchBuilds} loading={loading} />
      </div>

      {error && <ErrorAlert error={error} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Builds</span>
          <p className="text-3xl font-bold text-white mt-2">{loading ? '--' : builds.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Completed</span>
          <p className="text-3xl font-bold text-green-400 mt-2">{loading ? '--' : completedBuilds.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Steps</span>
          <p className="text-3xl font-bold text-white mt-2">{loading ? '--' : avgSteps || '--'}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : builds.length === 0 && !error ? (
        <div className="text-center py-12">
          <Hammer className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No build jobs found.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Title</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Status</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Difficulty</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Steps</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {builds.map((build) => (
                <tr key={build.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-white font-medium text-xs">{build.title ?? build.id.slice(0, 12)}</td>
                  <td className={`p-4 font-bold text-xs uppercase ${STATUS_COLOR[build.status] ?? 'text-slate-400'}`}>
                    {build.status}
                  </td>
                  <td className="p-4 text-slate-400 text-xs capitalize">{build.difficulty ?? '--'}</td>
                  <td className="p-4 text-white font-bold">{build.stepCount ?? '--'}</td>
                  <td className="p-4 text-slate-500 text-xs">
                    {build.createdAt ? new Date(build.createdAt).toLocaleString() : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
