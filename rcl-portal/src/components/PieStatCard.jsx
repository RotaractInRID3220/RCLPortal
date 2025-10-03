// PieStatCard.jsx
// Props: { title: string, registered: number, total: number, color?: string }
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function PieStatCard({ title, registered, total, color = 'cranberry', loading = false }) {
  const data = [
    { name: 'Registered', value: registered },
    { name: 'Unregistered', value: Math.max(total - registered, 0) },
  ];
  const COLORS = [
    color === 'cranberry' ? '#D81B5D' : color === 'blue' ? '#2563EB' : '#6B7280',
    '#3E0016',
  ];

  // Show skeleton loading state
  if (loading || (registered === 0 && total === 0)) {
    return (
      <div className={`bg-cranberry/10 border border-cranberry rounded-lg p-4 relative flex flex-col items-center justify-center`}>
        <h3 className="text-xl font-normal text-white mb-2 text-center">{title}</h3>
        <div className="w-full flex flex-col items-center justify-center">
          <div className="w-32 h-32 relative">
            {/* Skeleton pie chart */}
            <div className="w-32 h-32 rounded-full border-8 border-white/10 animate-pulse"></div>
            {/* Center skeleton text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="h-6 w-12 bg-white/20 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-cranberry/10 border border-cranberry rounded-lg p-4 relative flex flex-col items-center justify-center`}>
      <h3 className="text-xl font-normal text-white mb-2 text-center">{title}</h3>
      <div className="w-full flex flex-col items-center justify-center">
        <div className="w-32 h-32 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                startAngle={90}
                endAngle={-360}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-cranberry text-xl font-medium">
              {registered}/{total}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
