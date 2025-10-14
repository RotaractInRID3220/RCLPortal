import React from 'react';
import { Trophy, Medal, Award } from 'lucide-react';

// Props: { standings: array, loading: boolean }
export default function TournamentStandings({ standings, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <img src="/load.svg" alt="Loading" className="w-16" />
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">No standings data available.</p>
        <p className="text-gray-500 text-sm mt-2">Please ensure matches have been completed and scores recorded.</p>
      </div>
    );
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return null;
    }
  };

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

  const StandingRow = ({ standing, index }) => {
    const actualPlace = standing.place;
    const isTopThree = actualPlace <= 3;

    return (
      <div
        className={`
          flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200
          ${getRankStyle(actualPlace)}
          ${isTopThree ? 'transform hover:scale-[1.02]' : ''}
        `}
      >
        <div className="flex items-center space-x-4 flex-1">
          {/* Place/Rank */}
          <div className="flex items-center justify-center w-12 h-12">
            {getRankIcon(actualPlace) || (
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full font-bold
                ${actualPlace <= 3 ? 'text-white text-lg' : 'bg-white/10 text-white/70'}
              `}>
                {actualPlace}
              </div>
            )}
          </div>

          {/* Club Info */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold truncate ${isTopThree ? 'text-xl' : 'text-lg'}`}>
              {standing.club_name || '-'}
            </h3>
            <p className="text-sm text-gray-400">
              Tournament Standing
            </p>
          </div>

          {/* Points */}
          <div className="text-right">
            <div className={`font-bold ${isTopThree ? 'text-2xl' : 'text-xl'}`}>
              {standing.points}
            </div>
            <p className="text-sm text-gray-400">points</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Standings List */}
      <div className="space-y-3">
        {standings.map((standing, index) => (
          <StandingRow
            key={standing.club_id || index}
            standing={standing}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
