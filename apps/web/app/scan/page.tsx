import { ScanUploader } from '../../components/scan/ScanUploader';
import { JobHistory } from '../../components/jobs/JobHistory';

export default function ScanPage() {
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">Scan Bricks</h1>
        <p className="text-slate-400 mb-8">Upload a photo of your LEGO bricks to identify them with AI.</p>
        <ScanUploader />

        <div className="mt-12 pt-8 border-t border-lego-border">
          <h2 className="text-lg font-bold text-white mb-4">Scan History</h2>
          <JobHistory type="scan" />
        </div>
      </div>
    </main>
  );
}
