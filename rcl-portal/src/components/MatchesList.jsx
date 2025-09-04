"use client";
import React from "react";
import { useMatches } from "@/hooks/useMatches";
import { createMatch } from "@/services/matchServices";

const MatchesList = () => {
  const { matches, loading, error, refetch } = useMatches();

  const handleCreateMatch = async () => {
    try {
      const newMatch = {
        participant_A: "Team A",
        participant_B: "Team B",
        match_name: "Football",
        start_time: new Date().toISOString(),
      };

      await createMatch(newMatch);
      // No need to manually update state - real-time subscription will handle it
    } catch (error) {
      console.error("Failed to create match:", error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-4">Loading matches...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
        <button
          onClick={refetch}
          className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Matches</h1>
        <div className="space-x-2">
          <button
            onClick={handleCreateMatch}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Create Test Match
          </button>
          <button
            onClick={refetch}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {matches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No matches found. Create one to get started!
          </div>
        ) : (
          matches.map((match) => (
            <div
              key={match.id}
              className="border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    {match.participant_A} vs {match.participant_B}
                  </h3>
                  <p className="text-gray-600">{match.sport}</p>
                  <p className="text-sm text-gray-500">
                    Status: <span className="capitalize">{match.status}</span>
                  </p>
                  {match.scheduled_at && (
                    <p className="text-sm text-gray-500">
                      Scheduled: {new Date(match.scheduled_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-400">ID: {match.id}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>🔄 Real-time updates enabled</p>
        <p>Total matches: {matches.length}</p>
      </div>
    </div>
  );
};

export default MatchesList;
