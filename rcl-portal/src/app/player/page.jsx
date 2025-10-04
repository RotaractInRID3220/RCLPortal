'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchPlayers } from '@/services/playerService';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Search, User, QrCode, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

export default function PlayerSearchPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nic, setNic] = useState('');
  const [rmisId, setRmisId] = useState('');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);

  // Performs player search with pagination
  const handleSearch = async (page = 1) => {
    // Check if at least one field has a value
    if (!name.trim() && !nic.trim() && !rmisId.trim()) {
      toast.error('Please enter at least one search criteria');
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);
      const result = await searchPlayers(name, nic, rmisId, page, 10);
      setPlayers(result.players || []);
      setTotalPages(result.totalPages || 0);
      setTotal(result.total || 0);
      setCurrentPage(page);
      
      if ((result.players || []).length === 0) {
        toast.info('No players found');
        setIsSearchExpanded(true); // Keep expanded if no results
      } else {
        setIsSearchExpanded(false); // Collapse when results found
      }
    } catch (error) {
      toast.error('Failed to search players');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(1);
    }
  };

  // Clear search and results
  const handleClear = () => {
    setName('');
    setNic('');
    setRmisId('');
    setPlayers([]);
    setTotalPages(0);
    setTotal(0);
    setCurrentPage(1);
    setHasSearched(false);
    setIsSearchExpanded(true);
  };

  // Navigates to player QR lanyard page
  const handlePlayerClick = (rmisId) => {
    router.push(`/player/${rmisId}`);
  };

  // Navigates to next page
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handleSearch(currentPage + 1);
    }
  };

  // Toggle search form expansion
  const toggleSearchForm = () => {
    setIsSearchExpanded(!isSearchExpanded);
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className='w-[800px] h-[600px] fixed -top-80 left-0 right-0 mx-auto bg-cranberry/75 z-0 rounded-full blur-[18rem] opacity-60 '></div>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center flex flex-col lg:flex-row lg:space-x-5 items-center justify-center mb-8 my-10">
          <img src="/rcl-white.png" alt="" className='w-2/5 lg:w-1/5 mb-10 z-10'/>
          <div className=' lg:items-start flex flex-col z-10'>
            <div className="flex items-center justify-center gap-3 mb-2">
              <QrCode className="w-8 h-8 text-cranberry" />
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                Player Search
              </h1>
            </div>
            <p className="text-muted-foreground">
              Search by Name, RMIS ID, or NIC
            </p>
          </div>
        </div>

        {/* Search Form */}
        {isSearchExpanded && (
          <Card className="p-6 mb-6 bg-card border-border z-10">
            <div className="space-y-4 z-10">
              {/* Name Input */}
              <div>
                <Label htmlFor="name" className="text-foreground mb-2 block">
                  Player Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter player name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="h-11 bg-background border-border focus:border-cranberry focus:ring-cranberry z-10"
                />
              </div>

              {/* RMIS ID Input */}
              <div>
                <Label htmlFor="rmisId" className="text-foreground mb-2 block">
                  RMIS ID
                </Label>
                <Input
                  id="rmisId"
                  type="text"
                  placeholder="Enter RMIS ID..."
                  value={rmisId}
                  onChange={(e) => setRmisId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="h-11 bg-background border-border focus:border-cranberry focus:ring-cranberry"
                />
              </div>

              {/* NIC Input */}
              <div>
                <Label htmlFor="nic" className="text-foreground mb-2 block">
                  NIC
                </Label>
                <Input
                  id="nic"
                  type="text"
                  placeholder="Enter NIC..."
                  value={nic}
                  onChange={(e) => setNic(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="h-11 bg-background border-border focus:border-cranberry focus:ring-cranberry"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => handleSearch(1)}
                  disabled={loading}
                  className="flex-1 h-11 bg-cranberry hover:bg-cranberry/90 text-white font-semibold cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Search
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClear}
                  disabled={loading}
                  variant="outline"
                  className="h-11 border-border hover:bg-muted"
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Toggle Search Form Button */}
        {!isSearchExpanded && (
          <div className="mb-6">
            <Button
              onClick={toggleSearchForm}
              variant="outline"
              className="w-full h-11 border-border hover:bg-cranberry hover:text-white hover:border-cranberry"
            >
              <Search className="w-5 h-5 mr-2" />
              Show Search Form
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-cranberry border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-muted-foreground">Searching players...</p>
          </div>
        )}

        {/* No Results */}
        {!loading && hasSearched && players.length === 0 && (
          <div className="text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg text-muted-foreground">No players found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try different search criteria
            </p>
          </div>
        )}

        {/* Search Hint */}
        {!loading && !hasSearched && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">
              Enter search criteria and click Search
            </p>
          </div>
        )}

        {/* Results Count */}
        {!loading && players.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Found {total} player{total !== 1 ? 's' : ''} • Page {currentPage} of {totalPages}
            </div>
            <Button
              onClick={toggleSearchForm}
              variant="ghost"
              size="sm"
              className="text-cranberry hover:text-cranberry/80 hover:bg-cranberry/10"
            >
              {isSearchExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Search
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show Search
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results List */}
        {!loading && players.length > 0 && (
          <div className="space-y-3 mb-6">
            {players.map((player) => (
              <Card
                key={player.RMIS_ID}
                onClick={() => handlePlayerClick(player.RMIS_ID)}
                className="p-4 cursor-pointer hover:border-cranberry transition-all duration-200 hover:shadow-lg hover:shadow-cranberry/20 active:scale-[0.98] bg-card border-border"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg truncate">
                      {player.name || '-'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {player.clubs?.club_name || '-'}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>RMIS: {player.RMIS_ID}</span>
                      {player.NIC && <span>NIC: {player.NIC}</span>}
                    </div>
                  </div>
                  <QrCode className="w-6 h-6 text-cranberry flex-shrink-0 ml-3" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && players.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
              className="flex-1 border-border hover:bg-cranberry hover:text-white hover:border-cranberry disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {currentPage} / {totalPages}
            </div>
            <Button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
              className="flex-1 border-border hover:bg-cranberry hover:text-white hover:border-cranberry disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
