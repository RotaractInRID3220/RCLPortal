"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PrivateRoute from "@/lib/PrivateRoute";

// Send an announcement to everyone with portal access (club presidents, secretaries and admins).
// It appears on their dashboards at once. Deadline reminders (24 h and 1 h before) are created automatically.
const when = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export default function AnnouncementsAdminPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expires, setExpires] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState([]);
  const [audience, setAudience] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/announcements", { cache: "no-store" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load announcements");
    setItems(data.data);
    setAudience(data.audience);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    const t = setInterval(() => load().catch(() => {}), 30000);   // read counts keep moving
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    try {
      setSending(true);
      const payload = { title: title.trim(), body: body.trim() };
      if (expires) payload.expires_at = new Date(expires).toISOString();
      const res = await fetch("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not send");
      toast.success(data.message);
      setTitle(""); setBody(""); setExpires("");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const retract = async (id) => {
    if (!confirm("Remove this announcement for everyone?")) return;
    const res = await fetch(`/api/admin/announcements?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) return toast.error(data.error || "Could not remove it");
    toast.success("Announcement removed");
    load().catch(() => {});
  };

  return (
    <PrivateRoute requiredPermission="super_admin" accessType="admin">
      <div>
        <h1 className="text-3xl font-semibold tracking-wide mb-2">ANNOUNCEMENTS</h1>
        <p className="text-white/50 text-sm mb-8">
          Sent to everyone with portal access ({audience || "…"} people) and shown on their dashboards immediately.
          Deadline reminders go out automatically a day and an hour before each closing time.
        </p>

        <div className="bg-white/5 rounded-lg p-6 mb-8 space-y-4">
          <Input placeholder="Title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            placeholder="Message (optional)"
            value={body}
            maxLength={2000}
            rows={5}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cranberry"
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm text-white/60">
              Hide after (optional)
              <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-white" />
            </label>
            <Button onClick={send} disabled={sending || !title.trim()} className="cursor-pointer bg-cranberry hover:bg-cranberry/80 text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Send to everyone
            </Button>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-3">Sent and automatic</h2>
        {!loaded && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cranberry" /></div>}
        {loaded && items.length === 0 && <p className="text-white/50">Nothing sent yet.</p>}
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="bg-white/5 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-white">{a.title}</p>
                {a.body && <p className="text-sm text-white/70 whitespace-pre-line mt-1">{a.body}</p>}
                <p className="text-xs text-white/40 mt-2">
                  {a.kind === "auto" ? "Automated reminder" : a.author_name} · {when(a.created_at)}
                  {a.expires_at && ` · hidden after ${when(a.expires_at)}`} · read by {a.read_count} of {audience}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => retract(a.id)} className="cursor-pointer shrink-0 text-red-300 border-red-400/40 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </PrivateRoute>
  );
}
