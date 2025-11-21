'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { userDeetsAtom } from '@/app/state/store';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, ArrowRight, Check, X } from 'lucide-react';
import PrivateRoute from '@/lib/PrivateRoute';

export default function AdminSwapsPage() {
  const [userDeets] = useAtom(userDeetsAtom);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    type: null, // 'approve' | 'reject'
    requestId: null,
  });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/swaps?tab=${activeTab}&limit=50`);
      const result = await response.json();

      if (result.success) {
        setRequests(result.data);
      } else {
        toast.error(result.error || 'Failed to fetch requests');
      }
    } catch (error) {
      console.error('Error fetching swaps:', error);
      toast.error('Failed to load swap requests');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async () => {
    const { type, requestId } = confirmDialog;
    if (!type || !requestId) return;

    try {
      setProcessingId(requestId);
      const endpoint = type === 'approve' ? '/api/admin/swaps/approve' : '/api/admin/swaps/reject';
      const body = type === 'approve' 
        ? { request_id: requestId, approved_by: userDeets?.membership_id || 'Admin' }
        : { request_id: requestId, rejected_by: userDeets?.membership_id || 'Admin' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Request ${type}d successfully`);
        fetchRequests();
      } else {
        toast.error(result.error || `Failed to ${type} request`);
      }
    } catch (error) {
      console.error(`Error ${type}ing swap:`, error);
      toast.error(`Failed to ${type} request`);
    } finally {
      setProcessingId(null);
      setConfirmDialog({ open: false, type: null, requestId: null });
    }
  };

  const getStatusBadge = (status) => {
    if (status === true) return <Badge className="bg-green-500">Approved</Badge>;
    if (status === false) return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/40">Pending</Badge>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseReason = (description) => {
    try {
      const parsed = JSON.parse(description);
      return parsed.reason || description;
    } catch {
      return description;
    }
  };

  return (
    <PrivateRoute requiredPermission="admin"  accessType="admin">
    
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">SWAP REQUESTS</h1>
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="pending" className="cursor-pointer data-[state=active]:bg-cranberry data-[state=active]:text-white">
            Pending
          </TabsTrigger>
          <TabsTrigger value="approved" className="cursor-pointer data-[state=active]:bg-cranberry data-[state=active]:text-white">
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="cursor-pointer data-[state=active]:bg-cranberry data-[state=active]:text-white">
            Rejected
          </TabsTrigger>
        </TabsList>

        <Card className="mt-6 bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold tracking-wide uppercase">
                {activeTab} Requests
              </CardTitle>
              <CardDescription className="text-white/60">
                {requests.length} request{requests.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/60">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="text-sm">Loading {activeTab} swap requests…</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-10 text-white/60 text-sm">
                No {activeTab} requests found
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-white/60">Date</TableHead>
                      <TableHead className="text-white/60">Club</TableHead>
                      {/* Type column removed as requested */}
                      <TableHead className="text-white/60">Details</TableHead>
                      <TableHead className="text-white/60">Reason</TableHead>
                      <TableHead className="text-white/60">Status</TableHead>
                      {activeTab === 'pending' && (
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="whitespace-nowrap text-sm text-white/80">
                          {formatDate(req.created_at)}
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {req.club_name || 'Unknown Club'}
                        </TableCell>
                        {/* Type column removed as requested */}
                        <TableCell>
                          <div className="space-y-2 text-xs md:text-sm">
                            {/* Player 1 Move */}
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                              <span className="font-semibold text-white">
                                {req.player1.name}
                              </span>
                              <span className="text-white/60 text-[11px] md:text-xs">
                                ({req.player1.current_sport?.sport_name})
                              </span>
                              <ArrowRight className="h-3 w-3 text-white/40" />
                              <span className="font-medium text-white/90">
                                {req.type === 'player-swap'
                                  ? req.player2?.current_sport?.sport_name
                                  : req.target_sport?.sport_name}
                              </span>
                            </div>

                            {/* Player 2 Move (if swap) */}
                            {req.type === 'player-swap' && (
                              <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm text-white/90">
                                <span className="font-semibold text-white">
                                  {req.player2?.name}
                                </span>
                                <span className="text-white/60 text-[11px] md:text-xs">
                                  ({req.player2?.current_sport?.sport_name})
                                </span>
                                <ArrowRight className="h-3 w-3 text-white/40" />
                                <span className="font-medium">
                                  {req.player1.current_sport?.sport_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="max-w-[260px] text-sm text-white/80 align-top"
                          title={parseReason(req.description)}
                        >
                          <div className="line-clamp-2 md:line-clamp-3">
                            {parseReason(req.description)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        {activeTab === 'pending' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer h-9 w-9 p-0 border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/30 hover:text-white"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    type: 'approve',
                                    requestId: req.id,
                                  })
                                }
                                disabled={processingId === req.id}
                                aria-label="Approve swap request"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer h-9 w-9 p-0 border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/30 hover:text-white"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    type: 'reject',
                                    requestId: req.id,
                                  })
                                }
                                disabled={processingId === req.id}
                                aria-label="Reject swap request"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'approve' ? 'Approve Swap Request' : 'Reject Swap Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmDialog.type} this swap request?
              {confirmDialog.type === 'approve' && ' This will immediately update the player registrations.'}
              {confirmDialog.type === 'reject' && ' This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={
                confirmDialog.type === 'approve'
                  ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                  : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
              }
            >
              {confirmDialog.type === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PrivateRoute>
  );
}
