"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClub, fetchClubs } from "@/services/clubServices";
import { clubsAtom, clubsLoadingAtom, clubsErrorAtom } from "@/app/state/store";
import { useAtom } from "jotai";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

const page = () => {
  const [addClub, setAddClub] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubId, setClubId] = useState("");
  const [clubCategory, setClubCategory] = useState("");
  
  // Jotai atoms for clubs
  const [clubs, setClubs] = useAtom(clubsAtom);
  const [loading, setLoading] = useAtom(clubsLoadingAtom);
  const [error, setError] = useAtom(clubsErrorAtom);

  // Fetch clubs on component mount
  useEffect(() => {
    fetchClubsData();
  }, []);

  const fetchClubsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const clubsData = await fetchClubs();
      setClubs(clubsData);
    } catch (error) {
      console.error('Error fetching clubs:', error);
      setError(error.message || 'Failed to fetch clubs');
      toast.error("Failed to fetch clubs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return clubCategory !== "" && clubName !== "" && clubId !== "";
  };

  const handleCreateClub = async () => {
    try {
      const clubData = {
        club_id: clubId,
        club_name: clubName,
        category: clubCategory,
      };

      const createdClub = await createClub(clubData);
      toast.success("Club created successfully!");
      
      // Add the new club to the existing clubs array
      setClubs(prevClubs => [...prevClubs, createdClub]);
      
      // Reset form fields
      setClubId("");
      setClubName("");
      setClubCategory("");
    } catch (error) {
      toast.error("Failed to create club: " + error.message);
    }
  };

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">CLUB MANAGEMENT</h1>
        {addClub ? (
          <Button
            className="bg-red-500/20 border border-cursor hover:bg-red-500 cursor-pointer text-white"
            onClick={() => setAddClub(false)}
          >
            x
          </Button>
        ) : (
          <Button
            className="bg-cranberry/20 border border-cursor hover:bg-cranberry cursor-pointer text-white"
            onClick={() => setAddClub(true)}
          >
            Add Club
          </Button>
        )}
      </div>

      {/* Add Club component */}
      {addClub && (
        <div className="bg-white/5 rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-2">Add Club</h2>
          <div className="grid grid-cols-2 gap-4 mt-4 ">
            <Input placeholder="Club ID" onChange={(e) => setClubId(e.target.value)} />
            <Input placeholder="Club Name" onChange={(e) => setClubName(e.target.value)} />
            <div className="w-full">
              <Select
                onValueChange={(value) => setClubCategory(value)}
                value={clubCategory}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Club Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="community">Community Based</SelectItem>
                  <SelectItem value="institute">Institute Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
            <Button
              className={`mt-5 w-1/4 ${
                isFormValid()
                  ? "bg-cranberry/80 hover:bg-cranberry border border-cranberry hover:shadow hover:shadow-cranberry text-white cursor-pointer"
                  : "bg-gray-500/50 border border-gray-500 text-gray-300 cursor-not-allowed"
              }`}
              disabled={!isFormValid()}
              onClick={handleCreateClub}
            >
              Add Event
            </Button>
        </div>
      )}

      <div className="mt-8">

        
        {loading && (
          <div className="text-center py-4">
            <p>Loading clubs...</p>
          </div>
        )}
        
        
        {!loading && !error && clubs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No clubs found. Add one to get started!</p>
          </div>
        )}
        
        <div className="space-y-4">
          {clubs.map((club, index) => (
            <div key={club.id || index} className="bg-white/5 rounded-lg py-4 px-6 w-full grid grid-cols-4">
              <h1 className="col-span-2">{club.club_name}</h1>
              <h1 className="col-span-1 text-white/50 text-sm">ID: <span className=" ml-2 text-white text-base">{club.club_id}</span></h1>
              <h1 className="col-span-1 text-white/50 text-sm">Category: <span className=" ml-2 text-white text-base">{club.category}</span></h1>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default page;
