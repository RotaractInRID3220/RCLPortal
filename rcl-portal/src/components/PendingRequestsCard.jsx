// Props: { count: number }

// Displays pending replacement requests count with notification styling
export default function PendingRequestsCard({ count = 0 }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-lg p-4 flex items-center justify-between">
      <div>
        <h3 className="text-md font-normal text-white">Pending Replacement Req</h3>
      </div>
      
      <div className="flex items-center space-x-3">
        <span className="text-xl font-normal text-black bg-white rounded-full w-8 h-8 flex items-center justify-center">
          {count}
        </span>
      </div>
    </div>
  );
}