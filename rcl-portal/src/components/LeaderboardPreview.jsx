import { useState } from 'react';

// Props: { leaderboardData: Array<{club_name: string, total_points: number, category: string}>, onCategoryChange?: function }

// Displays a preview of the leaderboard with top clubs and their points
export default function LeaderboardPreview({ leaderboardData = [], onCategoryChange }) {
  const [selectedCategory, setSelectedCategory] = useState('community'); // 'community', 'institute'

    // Get background style based on rank
    const getRankStyle = (rank) => {
      switch (rank) {
        case 1:
          return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 shadow-lg shadow-yellow-500/10';
        case 2:
          return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30 shadow-lg shadow-gray-400/10';
        case 3:
          return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30 shadow-lg shadow-amber-600/10';
        default:
          return 'bg-white/5 border-white/10 hover:bg-white/10';
      }
    };

  // Handle category change
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    if (onCategoryChange) {
      onCategoryChange(category);
    }
  };

  // Use all leaderboard data since filtering is now done server-side
  const displayData = leaderboardData;

  return (
    <div className="bg-black/80 border border-white/10 rounded-lg p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-normal text-white">Leaderboard</h2>
        <div className="flex items-center space-x-1 text-sm">
          <button
            onClick={() => handleCategoryChange('community')}
            className={`cursor-pointer transition-colors ${
              selectedCategory === 'community' 
                ? 'text-white font-semibold' 
                : 'text-white/70 hover:text-white/90'
            }`}
          >
            Com
          </button>
          <span className="text-white/70">|</span>
          <button
            onClick={() => handleCategoryChange('institute')}
            className={`cursor-pointer transition-colors ${
              selectedCategory === 'institute' 
                ? 'text-white font-semibold' 
                : 'text-white/70 hover:text-white/90'
            }`}
          >
            Institute
          </button>
        </div>
      </div>
      
      <div className="space-y-4">
        {displayData.length === 0 ? (
          // Loading skeleton rows
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-white/10 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/20 rounded w-3/4"></div>
            </div>
          ))
        ) : (
          displayData.slice(0, 5).map((club, index) => {
            const rank = index + 1;
            return (
              <div
                key={club.club_id || index}
                className={`flex justify-between items-center rounded-lg px-4 py-3 border transition-all duration-200 ${getRankStyle(rank)}`}
              >
                <div className="flex items-center space-x-4">
                  <span className={`font-semibold ${rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-600' : 'text-white/50'}`}>#{rank}</span>
                  <span className="text-white font-medium">{club.club_name || '-'}</span>
                </div>
                <div className="text-white/70 text-sm">
                  {club.total_points || 0} pts
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {displayData.length === 0 && (
        <div className="text-center text-white/50 mt-8">
          Loading leaderboard data...
        </div>
      )}
    </div>
  );
}