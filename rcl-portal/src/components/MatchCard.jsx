import React from "react";

const MatchCard = ({ match }) => {
  if (!match || !match.participants || match.participants.length < 2) {
    return null;
  }

  const [participant1, participant2] = match.participants;

  // Function to get team styling based on winner/loser status
  const getTeamStyling = (participant) => {
    if (match.state === "SCHEDULED" || !participant.resultText) {
      return {
        bgColor: "bg-white/10",
        scoreColor: "bg-white/20",
      };
    }

    if (participant.isWinner) {
      return {
        bgColor: "bg-green-500/15",
        scoreColor: "bg-green-600",
      };
    } else {
      return {
        bgColor: "bg-red-500/15",
        scoreColor: "bg-red-600",
      };
    }
  };

  const team1Styling = getTeamStyling(participant1);
  const team2Styling = getTeamStyling(participant2);

  // Format match title
  const getMatchTitle = () => {
    if (match.matchId) {
      return `#${match.matchId}`;
    }
    if (match.id) {
      return `Game ${match.id.padStart(2, "0")}`;
    }
    return "Game";
  };

  // Format score display
  const getScore = (participant) => {
    if (match.state === "SCHEDULED" || !participant.resultText) {
      return "-";
    }
    return participant.resultText;
  };

  return (
    <div className="h-max bg-white/10 w-full rounded-lg p-3 flex-shrink-0 hover:bg-white/15 duration-300">
      <p className="font-medium">{getMatchTitle()}</p>
      <div className="flex flex-col space-y-2 mt-3">
        <div
          className={`flex w-full ${team1Styling.bgColor} items-center justify-between py-2 px-4 rounded-md`}
        >
          <p className="text-sm font-medium">{participant1.name}</p>
          <p
            className={`w-10 h-8 flex items-center justify-center ${team1Styling.scoreColor} rounded-sm text-sm font-bold`}
          >
            {getScore(participant1)}
          </p>
        </div>
        <div
          className={`flex w-full ${team2Styling.bgColor} items-center justify-between py-2 px-4 rounded-md`}
        >
          <p className="text-sm font-medium">{participant2.name}</p>
          <p
            className={`w-10 h-8 flex items-center justify-center ${team2Styling.scoreColor} rounded-sm text-sm font-bold`}
          >
            {getScore(participant2)}
          </p>
        </div>
      </div>

      {/* Optional: Show match status or time */}
      {match.state === "SCHEDULED" && match.startTime && (
        <div className="mt-2 text-xs text-white/60 text-center">
          {new Date(match.startTime).toLocaleDateString()} at{" "}
          {new Date(match.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
      {match.state === "SCHEDULED" && !match.startTime && (
        <div className="mt-2 text-xs text-white/60 text-center">
          Time TBD
        </div>
      )}
    </div>
  );
};

export default MatchCard;
