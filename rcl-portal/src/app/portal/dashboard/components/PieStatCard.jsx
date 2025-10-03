// PieStatCard.jsx
// Props: { title: string, registered: number, total: number, color?: string }
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { APP_CONFIG } from '@/config/app.config';

export default function PieStatCard({ title, registered, total, color = 'cranberry', loading = false }) {
  const data = [
    { name: 'Registered', value: registered },
    { name: 'Unregistered', value: Math.max(total - registered, 0) },
  ];
  const COLORS = [
    color === 'cranberry' ? '#D81B5D' : color === 'blue' ? '#2563EB' : '#6B7280',
    '#ffffff',
  ];

  // Calculate general member percentage for warning
  const generalPercentage = total > 0 ? (registered / total) * 100 : 0;
  const showWarning = generalPercentage < APP_CONFIG.GENERAL_MEMBER_WARNING_THRESHOLD && total > 0;

  // Show skeleton loading state
  if (loading || (registered === 0 && total === 0)) {
    return (
      <div className={`bg-cranberry/10 border border-cranberry rounded-lg p-4 h-full relative flex flex-col items-center justify-center min-h-[180px]`}>
        <h3 className="text-xl font-normal text-white mb-2 text-center">{title}</h3>
        <div className="w-full flex flex-col items-center justify-center">
          <div className="w-48 h-48 relative">
            {/* Skeleton pie chart */}
            <div className="w-48 h-48 rounded-full border-8 border-white/10 animate-pulse"></div>
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
    <div className={`bg-cranberry/10 border border-cranberry rounded-lg p-4 relative h-full flex flex-col items-center justify-center min-h-[180px]`}>
      <h3 className="text-xl font-normal text-white mb-2 text-center">{title}</h3>
      <div className="w-full flex flex-col items-center justify-center">
        <div className="w-48 h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
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
        {/* Color legend below chart */}
        <div className="flex flex-row gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full" style={{ background: COLORS[0] }}></span>
            <span className="text-white text-sm">General</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full" style={{ background: COLORS[1] }}></span>
            <span className="text-white text-sm">Prospective</span>
          </div>
        </div>

        {/* Warning message for low general member percentage */}
        {showWarning && (
          <div className="mt-3 px-3 py-2 bg-yellow-500/20 border border-yellow-400 rounded-lg flex items-center gap-2">
            <div className="text-yellow-400 text-sm">⚠️</div>
            <div className="text-yellow-200 text-xs">
              Low general membership ratio ({generalPercentage.toFixed(1)}%)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
