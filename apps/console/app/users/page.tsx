'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Users, RefreshCw, AlertCircle } from 'lucide-react';

interface UserInventory {
  id: string;
  partCount: number;
  updatedAt: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(firestore, 'inventories'), limit(100)),
      );
      const data = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          partCount: Array.isArray(d.parts) ? d.parts.length : 0,
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
        };
      });
      data.sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
      setUsers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            {!loading && !error && `${users.length} users with inventories`}
            {(loading || error) && 'Anonymous users with inventories'}
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : users.length === 0 && !error ? (
        <div className="text-center py-12">
          <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No users found. Start the Firebase emulators and scan some bricks.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">User ID</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Parts</th>
                <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest p-4">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono text-xs text-slate-300">{user.id}</td>
                  <td className="p-4 text-white font-bold">{user.partCount}</td>
                  <td className="p-4 text-slate-500 text-xs">
                    {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '--'}
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
