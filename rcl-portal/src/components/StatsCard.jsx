// Props: { title: string, value: number, showIndicator?: boolean, indicatorColor?: string }

// Displays a statistic card with title, large number value, and optional colored indicator
export default function StatsCard({ title, value, showIndicator = false, indicatorColor = "bg-cranberry" }) {
  return (
    <div className={`${showIndicator ? indicatorColor : 'bg-cranberry/10'} border border-cranberry rounded-lg p-4 relative`}>
      <div className="text-center">
        <h3 className="text-xl font-normal text-white mb-2">{title}</h3>
        <div className="text-7xl font-bold text-white mb-4">{value}</div>
      </div>
    </div>
  );
}