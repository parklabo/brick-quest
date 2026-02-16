'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { ScanLine } from 'lucide-react';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { STATUS_COLOR } from '../../lib/constants';

interface ScanJob {
  id: string;
  status: string;
  createdAt: string | null;
  partCount: number | null;
}

export default function ScansPage() {
  const [scans, setScans] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(
          collection(firestore, 'jobs'),
          where('type', '==', 'scan'),
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
          partCount: result?.parts?.length ?? null,
        };
      });
      setScans(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch scans';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scan Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            {!loading && !error && `${scans.length} scan jobs`}
            {(loading || error) && 'Recent image scan jobs'}
          </p>
        </div>
        <RefreshButton onClick={fetchScans} loading={loading} />
      </div>

      {error && <ErrorAlert error={error} />}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : scans.length === 0 && !error ? (
        <div className="text-center py-12">
          <ScanLine className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No scan jobs found.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Job ID</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Status</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Parts</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono text-xs text-slate-300" title={scan.id}>{scan.id.slice(0, 12)}...</td>
                  <td className={`p-4 font-bold text-xs uppercase ${STATUS_COLOR[scan.status] ?? 'text-slate-400'}`}>
                    {scan.status}
                  </td>
                  <td className="p-4 text-white font-bold">{scan.partCount ?? '--'}</td>
                  <td className="p-4 text-slate-500 text-xs">
                    {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '--'}
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
