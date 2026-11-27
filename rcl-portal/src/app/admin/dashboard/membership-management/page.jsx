'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserMinus, RefreshCw, Shield, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import PrivateRoute from '@/lib/PrivateRoute';

// The penalty comes from the server (tiers and minimum players are admin settings); this page only
// colours it. Tiers are ordered harshest first (lowest threshold).
const TIER_STYLES = [
  { color: 'text-red-500', label: 'Critical' },
  { color: 'text-orange-500', label: 'Medium' },
  { color: 'text-yellow-500', label: 'Low' },
];
const tierIndex = (points, tiers) => [...tiers].sort((x, y) => x.lt - y.lt).findIndex((t) => t.points === points);
const getDeductionColor = (points, tiers) => points === 0 ? 'text-gray-500' : (TIER_STYLES[tierIndex(points, tiers)] ?? { color: 'text-red-500' }).color;
const getSeverityLabel = (points, tiers) => points === 0 ? 'None' : (TIER_STYLES[tierIndex(points, tiers)] ?? { label: 'Penalty' }).label;

const MembershipManagementPage = () => {
  const [membershipData, setMembershipData] = useState([]);
  const [rules, setRules] = useState({ tiers: [], minPlayers: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cleaningPlayers, setCleaningPlayers] = useState(false);
  const [syncingRMIS, setSyncingRMIS] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);

  // Fetch membership data
  const fetchMembershipData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch('/api/admin/membership-data');
      const result = await response.json();

      if (response.ok) {
        setMembershipData(result.data);
        if (result.rules) setRules(result.rules);
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
        toast.success(`Removed ${result.data?.removed ?? 0} player(s) without registrations`);
        // Refresh membership data after cleaning
        fetchMembershipData(true);
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
        toast.success(`RMIS sync done: ${result.data?.seen ?? 0} member record(s) checked, ${result.data?.playersChanged ?? 0} player(s) updated`);
        // Refresh membership data after syncing
        fetchMembershipData(true);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('RMIS sync failed: ' + error.message);
    } finally {
      setSyncingRMIS(false);
    }
  };

  // Handle apply rules: ONE request. The server refreshes from RMIS, removes players without
  // registrations, then SETS each club's penalty (one row per club). Running it again changes nothing.
  const handleApplyRules = async (refresh = true) => {
    if (applyingRules) return; // never fire twice
    try {
      setApplyingRules(true);
      const response = await fetch('/api/admin/apply-membership-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh, clean: true }),
      });
      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        fetchMembershipData(true);
      } else if (result.code === 'rmis_unavailable') {
        toast.error(result.error, { duration: 15000, action: { label: 'Apply without RMIS refresh', onClick: () => handleApplyRules(false) } });
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
      const aPoints = a.deduction;
      const bPoints = b.deduction;

      if (aPoints !== bPoints) {
        return aPoints - bPoints; // Lower deduction (more negative) first
      }

      return a.club_name.localeCompare(b.club_name);
    });

    return filtered;
  }, [membershipData, searchTerm]);

  return (
    <PrivateRoute requiredPermission="super_admin" accessType="admin">
      <div className="min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-wide text-white">MEMBERSHIP MANAGEMENT</h1>
          <p className="text-white/70 mt-2">Monitor club membership compliance and apply penalty rules</p>
        </div>

        {/* Summary Stats */}
        {!loading && membershipData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Total Clubs</p>
                  <p className="text-white text-2xl font-bold">{membershipData.length}</p>
                </div>
              </CardContent>
            </Card>

            {[...rules.tiers].sort((x, y) => x.lt - y.lt).map((t, i) => (
              <Card key={`${t.lt}-${t.points}`} className="bg-white/5 border-white/20">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-white/70 text-sm">{(TIER_STYLES[i]?.label ?? 'Penalty')}: {t.points} pts (below {t.lt}%)</p>
                    <p className={`${TIER_STYLES[i]?.color ?? 'text-red-500'} text-2xl font-bold`}>
                      {membershipData.filter((club) => club.deduction === t.points).length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Compliant Clubs</p>
                  <p className="text-green-500 text-2xl font-bold">
                    {membershipData.filter((club) => club.deduction === 0).length}
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
                    This refreshes members from RMIS, removes players without registrations, then sets each club's penalty from its general-member share. It is safe to run again: it sets the penalty, it never adds to it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={applyingRules} onClick={() => handleApplyRules(true)} className="bg-purple-600 hover:bg-purple-700">
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
                      const deductionPoints = club.deduction;
                      const severityColor = getDeductionColor(deductionPoints, rules.tiers);
                      const severityLabel = getSeverityLabel(deductionPoints, rules.tiers);

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
                              {club.pending_change ? (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-400">
                                  Not applied yet{club.applied_penalty !== 0 ? ` (currently ${club.applied_penalty})` : ''}
                                </span>
                              ) : club.applied_penalty !== 0 ? (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">Applied</span>
                              ) : null}
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