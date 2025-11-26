'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Download, Hash, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PrivateRoute from '@/lib/PrivateRoute';
import { SPORT_DAYS } from '@/config/app.config';
import useDebounce from '@/hooks/useDebounce';

export default function PlayerNumbersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]); // Store all data for client-side filtering
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeDay, setActiveDay] = useState(SPORT_DAYS.E_SPORT.value);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const itemsPerPage = 10;
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Sport day tabs configuration from SPORT_DAYS
  const sportDayTabs = Object.values(SPORT_DAYS).map(day => ({
    value: day.value,
    label: day.label
  }));

  // Fetches all player numbers for a sport day (no search/pagination)
  const fetchAllPlayerNumbers = useCallback(async (sportDay) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        sportDay: sportDay
        // No search or pagination params - fetch all data
      });

      const response = await fetch(`/api/admin/player-numbers?${params}`);
      const result = await response.json();

      if (result.success) {
        setAllPlayers(result.data);
        setTotalCount(result.totalCount || result.data.length);
        return result.data;
      } else {
        toast.error(result.error || 'Failed to fetch player numbers');
        return [];
      }
    } catch (error) {
      console.error('Error fetching player numbers:', error);
      toast.error('Failed to load player numbers');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Filters and paginates data client-side
  const filterAndPaginateData = useCallback((data, search, page) => {
    let filteredData = data;

    // Apply client-side search filter
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      filteredData = data.filter(player =>
        player.playerName.toLowerCase().includes(searchLower) ||
        player.rmisId.toLowerCase().includes(searchLower) ||
        player.clubName.toLowerCase().includes(searchLower) ||
        player.playerNumber.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const totalFilteredPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      totalPages: totalFilteredPages,
      totalCount: filteredData.length
    };
  }, []);

  // Updates displayed data based on current filters
  const updateDisplayedData = useCallback(() => {
    const result = filterAndPaginateData(allPlayers, debouncedSearch, currentPage);
    setPlayers(result.data);
    setTotalPages(result.totalPages);
    // Keep totalCount as the full dataset count for display
  }, [allPlayers, debouncedSearch, currentPage, filterAndPaginateData]);

  useEffect(() => {
    fetchAllPlayerNumbers(activeDay);
    setCurrentPage(1);
    setSearchTerm('');
  }, [activeDay, fetchAllPlayerNumbers]);

  useEffect(() => {
    updateDisplayedData();
  }, [updateDisplayedData]);

  // Handle tab change
  const handleDayChange = (day) => {
    setActiveDay(day);
    // fetchAllPlayerNumbers will be called via useEffect
  };

  // Handle search input
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Export data as CSV
  const handleExport = async () => {
    try {
      setExporting(true);

      // Use the already fetched data for export
      if (allPlayers.length === 0) {
        toast.info('No data to export for this day');
        return;
      }

      // Create CSV content from allPlayers (already sorted)
      const headers = ['Player Number', 'RMIS ID', 'Name', 'Club Name', 'Sport'];
      const rows = allPlayers.map(player => [
        player.playerNumber,
        player.rmisId,
        player.playerName,
        player.clubName,
        player.sportName
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dayLabel = sportDayTabs.find(t => t.value === activeDay)?.label || activeDay;
      link.href = url;
      link.download = `player_numbers_${dayLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allPlayers.length} players successfully`);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  // Render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={currentPage === i ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePageChange(i)}
          className="cursor-pointer"
        >
          {i}
        </Button>
      );
    }

    // Calculate filtered count for display
    const filteredResult = filterAndPaginateData(allPlayers, debouncedSearch, currentPage);
    const filteredCount = filteredResult.totalCount;

    return (
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-white/60">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCount)} of {filteredCount} players
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="cursor-pointer"
          >
            Previous
          </Button>
          {pages}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="cursor-pointer"
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  return (
    <PrivateRoute requiredPermission="admin" accessType="admin">
      <div>
        <div className="flex w-full justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold tracking-wide">PLAYER NUMBERS</h1>
        </div>

        <Tabs value={activeDay} onValueChange={handleDayChange}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <TabsList className="bg-white/5 border border-white/10">
              {sportDayTabs.map((day) => (
                <TabsTrigger
                  key={day.value}
                  value={day.value}
                  className="cursor-pointer data-[state=active]:bg-cranberry data-[state=active]:text-white"
                >
                  {day.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <Button
              onClick={handleExport}
              disabled={exporting || loading}
              className="cursor-pointer bg-green-600 hover:bg-green-700 text-white"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold tracking-wide uppercase flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  {sportDayTabs.find(t => t.value === activeDay)?.label || 'Players'}
                </CardTitle>
                <CardDescription className="text-white/60">
                  {allPlayers.length} player{allPlayers.length !== 1 ? 's' : ''} registered
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search by player number, name, RMIS ID, or club..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-10 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-white/60">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Loading player numbers…</p>
                </div>
              ) : players.length === 0 ? (
                <div className="text-center py-10 text-white/60 text-sm">
                  No players found for {sportDayTabs.find(t => t.value === activeDay)?.label}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-white/10 bg-black/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-white/60 w-[140px]">Player Number</TableHead>
                          <TableHead className="text-white/60">RMIS ID</TableHead>
                          <TableHead className="text-white/60">Name</TableHead>
                          <TableHead className="text-white/60">Club Name</TableHead>
                          <TableHead className="text-white/60">Sport</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {players.map((player) => (
                          <TableRow
                            key={`${player.registrationId}`}
                            className="border-white/5 hover:bg-white/5"
                          >
                            <TableCell className="font-mono font-semibold text-cranberry">
                              {player.playerNumber}
                            </TableCell>
                            <TableCell className="text-white/80">
                              {player.rmisId}
                            </TableCell>
                            <TableCell className="font-medium text-white">
                              {player.playerName}
                            </TableCell>
                            <TableCell className="text-white/80">
                              {player.clubName}
                            </TableCell>
                            <TableCell className="text-white/80">
                              {player.sportName}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {renderPagination()}
                </>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </PrivateRoute>
  );
}
