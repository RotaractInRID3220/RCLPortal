import Link from 'next/link';

// Pending replacement and swap requests waiting for an admin decision. Live (the dashboard refreshes
// every 30 s); each part links to the page where they are decided.
export default function PendingRequestsCard({ count = 0, replacements = 0, swaps = 0 }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-normal text-white">Pending Replacement Req</h3>
        <span className={`text-xl font-normal rounded-full w-8 h-8 flex items-center justify-center ${count > 0 ? 'bg-cranberry text-white' : 'bg-white text-black'}`}>
          {count}
        </span>
      </div>
      {count > 0 && (
        <div className="mt-3 flex gap-4 text-sm">
          {replacements > 0 && <Link href="/admin/dashboard/replacements" className="text-white/70 underline hover:text-white">{replacements} replacement{replacements === 1 ? '' : 's'}</Link>}
          {swaps > 0 && <Link href="/admin/dashboard/swaps" className="text-white/70 underline hover:text-white">{swaps} swap{swaps === 1 ? '' : 's'}</Link>}
        </div>
      )}
    </div>
  );
}
