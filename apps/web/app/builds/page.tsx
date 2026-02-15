import { BuildViewer } from '../../components/build/BuildViewer';
import { JobHistory } from '../../components/jobs/JobHistory';

export default function BuildPage() {
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">3D Build Viewer</h1>
        <p className="text-slate-400 mb-8">Watch your creation come together step by step.</p>
        <BuildViewer />

        <div className="mt-12 pt-8 border-t border-lego-border">
          <h2 className="text-lg font-bold text-white mb-4">Build History</h2>
          <JobHistory type="build" />
        </div>
      </div>
    </main>
  );
}
