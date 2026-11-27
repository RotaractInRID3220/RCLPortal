'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, Download, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useDebounce from '@/hooks/useDebounce';

// Bib numbers for track events, swimming and the road race. One number per player, assigned with one
// click, never changed afterwards. A number follows the replacement when its player is replaced.
const FILTERS = [['all', 'All'], ['assigned', 'Assigned'], ['missing', 'Missing'], ['unused', 'Unused']];
const LIMIT = 25;

export default function BibNumbersPanel() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ filter, page: String(page), limit: String(LIMIT) });
    if (debounced.trim()) params.set('search', debounced.trim());
    const res = await fetch(`/api/admin/bibs?${params}`, { cache: 'no-store' });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Failed to load bib numbers');
    setRows(body.data); setTotal(body.total); setStatus(body.status); setLoaded(true);
  }, [filter, page, debounced]);

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]);
  useEffect(() => { setPage(1); }, [filter, debounced]);

  const handleAssign = async () => {
    try {
      setAssigning(true);
      const res = await fetch('/api/admin/bibs', { method: 'POST' });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'Could not assign bib numbers');
      toast.success(body.message);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/admin/bibs?filter=assigned&all=1', { cache: 'no-store' });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = ['Bib,Name,Club,Events', ...body.data.map((r) => [r.bib, r.name, r.club_name, (r.events || []).join('; ')].map(esc).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'bib-numbers.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const missing = status?.missing ?? 0;

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-2">
        <h1 className="text-3xl font-semibold tracking-wide">BIB NUMBERS</h1>
        <div className="flex gap-3">
          <Button onClick={handleExport} disabled={exporting || !status?.assigned} className="cursor-pointer bg-green-600 hover:bg-green-700 text-white">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Export CSV
          </Button>
          <Button onClick={handleAssign} disabled={assigning || missing === 0} className="cursor-pointer bg-cranberry hover:bg-cranberry/80 text-white">
            {assigning ? 'Assigning...' : missing ? `Assign ${missing} missing number${missing === 1 ? '' : 's'}` : 'All numbers assigned'}
          </Button>
        </div>
      </div>
      <p className="text-white/50 text-sm mb-6">
        For players in track events, swimming and the road race. One number per player, handed out in order (001, 002, ...), never changed afterwards.
        If a player is replaced, the number goes to the player who takes over. {status && `Next number: ${status.next_display}.`}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[['Assigned', status?.assigned], ['Missing a number', status?.missing], ['Unused (player left)', status?.unused], ['Bib events', status?.bib_events]].map(([label, value]) => (
          <Card key={label} className="bg-white/5 border-white/10">
            <CardHeader className="pb-1"><CardTitle className="text-sm font-normal text-white/60">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold text-white">{value ?? '-'}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          {FILTERS.map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)} className={`cursor-pointer rounded-md px-3 py-1 text-sm ${filter === v ? 'bg-cranberry text-white' : 'text-white/70 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, name, club..." className="pl-9" />
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          {!loaded ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-cranberry" /></div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-white/50">
              {status?.bib_events === 0 ? 'No events need a bib number yet.' : 'No players match.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Bib</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.member_id}>
                    <TableCell className="font-mono text-lg font-semibold">
                      {r.bib ? <span className="inline-flex items-center gap-1 text-white"><Hash className="h-4 w-4 text-white/40" />{r.bib}</span> : <span className="text-yellow-300 text-sm font-sans">needs a number</span>}
                    </TableCell>
                    <TableCell>
                      {r.name}
                      {r.transferred_from && <span className="ml-2 text-xs text-white/40">(handed over from a replaced player)</span>}
                    </TableCell>
                    <TableCell className="text-white/70">{r.club_name ?? '-'}</TableCell>
                    <TableCell className="text-white/70">
                      {r.in_bib_event ? (r.events || []).join(', ') : <span className="text-red-300">no bib event any more (number stays retired)</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-white/60">Page {page} of {pages} ({total} players)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="cursor-pointer">Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="cursor-pointer">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
