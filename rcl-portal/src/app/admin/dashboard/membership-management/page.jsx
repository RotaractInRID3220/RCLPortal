'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserMinus, RefreshCw, Shield, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import PrivateRoute from '@/lib/PrivateRoute';

// Calculates deduction points based on general member percentage
const calculateDeductionPoints = (percentage, totalPlayers = 0) => {
  // Don't apply deductions to clubs with no players
  if (totalPlayers === 0) return 0;

  if (percentage >= 67 && percentage < 70) return -25;
  if (percentage >= 62 && percentage < 67) return -50;
  if (percentage < 62) return -80;
  return 0;
};

// Gets color class based on deduction points
const getDeductionColor = (points) => {
  if (points === -80) return 'text-red-500'; // critical
  if (points === -50) return 'text-orange-500'; // medium
  if (points === -25) return 'text-yellow-500'; // low
  return 'text-gray-500'; // none
};

// Gets severity label based on deduction points
const getSeverityLabel = (points) => {
  if (points === -80) return 'Critical';
  if (points === -50) return 'Medium';
  if (points === -25) return 'Low';
  return 'None';
};

const MembershipManagementPage = () => {
  const [membershipData, setMembershipData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cleaningPlayers, setCleaningPlayers] = useState(false);
  const [syncingRMIS, setSyncingRMIS] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);

  // Fetch membership data
  const fetchMembershipData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/membership-data');
      const result = await response.json();

      if (response.ok) {
        setMembershipData(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error fetching membership data:', error);
      toast.error('Failed to load membership data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembershipData();
  }, []);

  // Handle global clean players
  const handleGlobalCleanPlayers = async () => {
    try {
      setCleaningPlayers(true);
      const response = await fetch('/api/players/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        // Refresh membership data after cleaning
        fetchMembershipData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to clean players globally: ' + error.message);
    } finally {
      setCleaningPlayers(false);
    }
  };

  // Handle sync with RMIS
  const handleSyncRMIS = async () => {
    try {
      setSyncingRMIS(true);
      const response = await fetch('/api/players/sync-rmis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        // Refresh membership data after syncing
        fetchMembershipData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('RMIS sync failed: ' + error.message);
    } finally {
      setSyncingRMIS(false);
    }
  };

  // Handle apply rules
  const handleApplyRules = async () => {
    try {
      setApplyingRules(true);

      // First run global clean and sync
      await handleGlobalCleanPlayers();
      await handleSyncRMIS();

      // Then apply deduction rules
      const response = await fetch('/api/admin/apply-membership-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        // Refresh membership data after applying rules
        fetchMembershipData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to apply membership rules: ' + error.message);
    } finally {
      setApplyingRules(false);
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = membershipData.filter(club =>
      club.club_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by deduction points (ascending), then by name (ascending)
    filtered.sort((a, b) => {
      const aPoints = calculateDeductionPoints(a.general_member_percentage, a.total_players_count);
      const bPoints = calculateDeductionPoints(b.general_member_percentage, b.total_players_count);

      if (aPoints !== bPoints) {
        return aPoints - bPoints; // Lower deduction (more negative) first
      }

      return a.club_name.localeCompare(b.club_name);
    });

    return filtered;
  }, [membershipData, searchTerm]);

  return (
    <PrivateRoute requiredPermission="admin" accessType="admin">
      <div className="min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-wide text-white">MEMBERSHIP MANAGEMENT</h1>
          <p className="text-white/70 mt-2">Monitor club membership compliance and apply penalty rules</p>
        </div>

        {/* Summary Stats */}
        {!loading && membershipData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Total Clubs</p>
                  <p className="text-white text-2xl font-bold">{membershipData.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Critical Violations</p>
                  <p className="text-red-500 text-2xl font-bold">
                    {membershipData.filter(club => calculateDeductionPoints(club.general_member_percentage, club.total_players_count) === -80).length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Medium Violations</p>
                  <p className="text-orange-500 text-2xl font-bold">
                    {membershipData.filter(club => calculateDeductionPoints(club.general_member_percentage, club.total_players_count) === -50).length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Low Violations</p>
                  <p className="text-yellow-500 text-2xl font-bold">
                    {membershipData.filter(club => calculateDeductionPoints(club.general_member_percentage, club.total_players_count) === -25).length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Compliant Clubs</p>
                  <p className="text-green-500 text-2xl font-bold">
                    {membershipData.filter(club => calculateDeductionPoints(club.general_member_percentage, club.total_players_count) === 0).length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Controls */}
        <div className="flex justify-between items-center mb-6">
          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
            <Input
              placeholder="Search clubs by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-white/20 text-white placeholder-white/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={cleaningPlayers}
                  className="bg-red-500/20 border border-red-500 hover:bg-red-500/30 text-red-200"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  {cleaningPlayers ? 'Cleaning...' : 'Global Clean'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Confirm Global Clean</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    This will remove players without registrations from ALL clubs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGlobalCleanPlayers} className="bg-red-600 hover:bg-red-700">
                    Confirm Global Clean
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={syncingRMIS}
                  className="bg-blue-500/20 border border-blue-500 hover:bg-blue-500/30 text-blue-200"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {syncingRMIS ? 'Syncing...' : 'Sync RMIS'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Confirm Global RMIS Sync</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    This will fetch and update player status data from RMIS for ALL clubs.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSyncRMIS} className="bg-blue-600 hover:bg-blue-700">
                    Confirm Global Sync
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={applyingRules}
                  className="bg-purple-500/20 border border-purple-500 hover:bg-purple-500/30 text-purple-200"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {applyingRules ? 'Applying...' : 'Apply Rules'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Confirm Apply Membership Rules</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    This will run global clean and sync operations, then apply penalty points to clubs based on their general member registration percentages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApplyRules} className="bg-purple-600 hover:bg-purple-700">
                    Confirm Apply Rules
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Membership Data Table */}
        <Card className="bg-white/5 border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Club Membership Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-white/70">Loading membership data...</p>
              </div>
            ) : filteredAndSortedData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/70">No clubs found matching your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-3 px-4 text-white font-semibold">Club Name</th>
                      <th className="text-center py-3 px-4 text-white font-semibold">General Member %</th>
                      <th className="text-center py-3 px-4 text-white font-semibold">General Members</th>
                      <th className="text-center py-3 px-4 text-white font-semibold">Prospective Members</th>
                      <th className="text-center py-3 px-4 text-white font-semibold">Points to Deduct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedData.map((club) => {
                      const deductionPoints = calculateDeductionPoints(club.general_member_percentage, club.total_players_count);
                      const severityColor = getDeductionColor(deductionPoints);
                      const severityLabel = getSeverityLabel(deductionPoints);

                      return (
                        <tr key={club.club_id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="py-4 px-4 text-white">{club.club_name}</td>
                          <td className="py-4 px-4 text-center text-white">
                            {club.general_member_percentage.toFixed(1)}%
                          </td>
                          <td className="py-4 px-4 text-center text-white">
                            {club.general_members_count}
                          </td>
                          <td className="py-4 px-4 text-center text-white">
                            {club.prospective_members_count}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {deductionPoints !== 0 ? (
                                <>
                                  <XCircle className={`w-4 h-4 ${severityColor}`} />
                                  <span className={`font-semibold ${severityColor}`}>
                                    {deductionPoints} pts ({severityLabel})
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 font-semibold">
                                    0 pts (Compliant)
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </PrivateRoute>
  );
};

export default MembershipManagementPage;