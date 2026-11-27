"use client";
import { Button } from "@/components/ui/button";
import { fetchAllClubsAdmin, syncClubsFromRmis } from "@/services/clubServices";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import PrivateRoute from "@/lib/PrivateRoute";

// Clubs come from RMIS (name, category, open/closed). Nothing is typed in here: use "Sync from RMIS"
// to pull the latest list now; the worker also does it every hour.
const page = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setClubs(await fetchAllClubsAdmin());
    } catch (e) {
      setError(e.message);
      toast.error("Failed to fetch clubs: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const r = await syncClubsFromRmis();
      toast.success(`Synced ${r.clubs} clubs from RMIS`);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const active = clubs.filter((c) => c.status === 1).length;
  const lastSync = clubs.map((c) => c.synced_at).filter(Boolean).sort().at(-1);

  return (
    <PrivateRoute requiredPermission="super_admin" accessType="admin">
      <div>
        <div className="flex w-full justify-between items-center mb-2">
          <h1 className="text-3xl font-semibold tracking-wide">CLUBS</h1>
          <Button
            className="bg-cranberry/20 border border-cursor hover:bg-cranberry cursor-pointer text-white"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Syncing..." : "Sync from RMIS"}
          </Button>
        </div>
        <p className="text-white/50 text-sm mb-8">
          Clubs are managed in RMIS and mirrored here. {clubs.length > 0 && `${active} active of ${clubs.length}.`}
          {lastSync && ` Last synced ${new Date(lastSync).toLocaleString()}.`}
        </p>

        {loading && <div className="text-center py-4"><p>Loading clubs...</p></div>}
        {error && !loading && <div className="text-center py-4 text-red-400"><p>{error}</p></div>}
        {!loading && !error && clubs.length === 0 && (
          <div className="text-center py-8 text-gray-500"><p>No clubs yet. Press "Sync from RMIS".</p></div>
        )}

        <div className="space-y-4">
          {clubs.map((club) => (
            <div key={club.club_id} className={`bg-white/5 rounded-lg py-4 px-6 w-full grid grid-cols-5 ${club.status === 1 ? "" : "opacity-50"}`}>
              <h1 className="col-span-2">{club.club_name}</h1>
              <h1 className="col-span-1 text-white/50 text-sm">ID: <span className="ml-2 text-white text-base">{club.club_id}</span></h1>
              <h1 className="col-span-1 text-white/50 text-sm">Category: <span className="ml-2 text-white text-base">{club.category}</span></h1>
              <h1 className="col-span-1 text-sm">{club.status === 1 ? <span className="text-green-300">Active</span> : <span className="text-red-300">Closed</span>}</h1>
            </div>
          ))}
        </div>
      </div>
    </PrivateRoute>
  );
};

export default page;
