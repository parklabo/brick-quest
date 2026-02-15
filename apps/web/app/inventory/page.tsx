import { PartsList } from '../../components/inventory/PartsList';

export default function InventoryPage() {
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">My Inventory</h1>
        <p className="text-slate-400 mb-8">Your scanned brick collection.</p>
        <PartsList />
      </div>
    </main>
  );
}
