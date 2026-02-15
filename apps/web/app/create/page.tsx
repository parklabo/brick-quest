import { CreateUploader } from '../../components/create/CreateUploader';
import { JobHistory } from '../../components/jobs/JobHistory';

export default function CreatePage() {
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">Create</h1>
        <p className="text-slate-400 mb-8">
          Photograph anything and get AI-generated LEGO building instructions.
        </p>
        <CreateUploader />

        <div className="mt-12 pt-8 border-t border-lego-border">
          <h2 className="text-lg font-bold text-white mb-4">Design History</h2>
          <JobHistory type="design" />
        </div>
      </div>
    </main>
  );
}
