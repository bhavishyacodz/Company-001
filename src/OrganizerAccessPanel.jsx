import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check, RefreshCw, Shield, UserRoundCog } from "lucide-react";

const supabase = createClient(
  "https://zkzgkovwktljfuuuhivk.supabase.co",
  "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB"
);

export default function OrganizerAccessPanel({ currentUser }) {
  const [organizers, setOrganizers] = useState([]);
  const [events, setEvents] = useState([]);
  const [grants, setGrants] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [accessLevel, setAccessLevel] = useState("editor");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [orgResult, eventResult, grantResult] = await Promise.all([
        supabase.from("organizers").select("id,owner_user_id,display_name,slug,status").order("display_name"),
        supabase.from("events").select("id,organizer_id,title,slug,status,organizers!inner(display_name,owner_user_id)").order("title"),
        supabase.from("organizer_event_access").select("id,user_id,event_id,access_level,created_at").order("created_at", { ascending: false })
      ]);
      if (orgResult.error) throw orgResult.error;
      if (eventResult.error) throw eventResult.error;
      if (grantResult.error) throw grantResult.error;
      setOrganizers(orgResult.data || []);
      setEvents(eventResult.data || []);
      setGrants(grantResult.data || []);
      if (!selectedUser && orgResult.data?.[0]) setSelectedUser(orgResult.data[0].owner_user_id);
      if (!selectedEvent && eventResult.data?.[0]) setSelectedEvent(eventResult.data[0].id);
    } catch (e) { setError(e.message || "Could not load organiser access."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const logAction = async (action, organizerId, targetType, targetId, metadata) => {
    const { error: logError } = await supabase.from("audit_logs").insert({
      actor_user_id: currentUser.id, organizer_id: organizerId || null,
      action, target_type: targetType, target_id: targetId, metadata
    });
    if (logError) throw logError;
  };

  const changeStatus = async (organizer, status) => {
    if (!["approved", "suspended"].includes(status) || organizer.status === status) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("organizers").update({ status, updated_at: new Date().toISOString() }).eq("id", organizer.id);
      if (updateError) throw updateError;
      await logAction(status === "suspended" ? "organizer_access_suspended" : "organizer_access_restored", organizer.id, "organizer", organizer.id, { previous_status: organizer.status, status });
      setNotice(status === "suspended" ? "Organiser suspended. Existing event grants remain saved but cannot be used while suspended." : "Organiser restored to approved access.");
      await load();
    } catch (e) { setError(e.message || "Could not update organiser access."); }
    finally { setBusy(false); }
  };

  const saveGrant = async () => {
    if (!selectedUser || !selectedEvent) return;
    const event = events.find(item => item.id === selectedEvent);
    const targetOrg = organizers.find(item => item.owner_user_id === selectedUser);
    if (!event || !targetOrg || targetOrg.status !== "approved") {
      setError("Choose an approved organiser and an event.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: grantError } = await supabase.from("organizer_event_access").upsert({
        user_id: selectedUser, event_id: selectedEvent, access_level: accessLevel, granted_by: currentUser.id
      }, { onConflict: "user_id,event_id" });
      if (grantError) throw grantError;
      await logAction("organizer_event_access_granted", event.organizer_id, "event", event.id, { user_id: selectedUser, access_level: accessLevel });
      setNotice("Event access saved.");
      await load();
    } catch (e) { setError(e.message || "Could not save event access."); }
    finally { setBusy(false); }
  };

  const revokeGrant = async (grant) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: deleteError } = await supabase.from("organizer_event_access").delete().eq("id", grant.id);
      if (deleteError) throw deleteError;
      const event = events.find(item => item.id === grant.event_id);
      await logAction("organizer_event_access_revoked", event?.organizer_id || null, "event", grant.event_id, { user_id: grant.user_id });
      setNotice("Event access revoked.");
      await load();
    } catch (e) { setError(e.message || "Could not revoke event access."); }
    finally { setBusy(false); }
  };

  const nameForUser = (userId) => organizers.find(item => item.owner_user_id === userId)?.display_name || userId;
  const eventForId = (eventId) => events.find(item => item.id === eventId);
  const orgForEvent = (event) => organizers.find(item => item.id === event?.organizer_id);
  const activeGrants = grants.filter(grant => eventForId(grant.event_id));
  return <section className="owner-card">
    <div className="owner-section-head"><div><span className="panel-label">ACCESS CONTROL</span><h2><UserRoundCog size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Organiser access panel</h2><p>Grant event-level viewer/editor access, suspend an organiser, or restore approved access. All changes are enforced by database policies.</p></div><button className="button button-secondary" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {error ? <p role="alert" className="owner-error">{error}</p> : null}
    {notice ? <p role="status" className="owner-muted">{notice}</p> : null}
    {loading ? <p className="owner-muted">Loading access records…</p> : <>
      <div className="owner-access-form">
        <label>Approved organiser<select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}><option value="">Choose organiser</option>{organizers.filter(o => o.status === "approved").map(o => <option key={o.id} value={o.owner_user_id}>{o.display_name} · {o.slug}</option>)}</select></label>
        <label>Event<select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}><option value="">Choose event</option>{events.map(event => <option key={event.id} value={event.id}>{event.title} · {orgForEvent(event)?.display_name || "Organiser"} · {event.status}</option>)}</select></label>
        <label>Permission<select value={accessLevel} onChange={e => setAccessLevel(e.target.value)}><option value="viewer">Viewer — view event and registrations</option><option value="editor">Editor — edit event and review registrations</option></select></label>
        <button className="button button-primary" disabled={busy || !selectedUser || !selectedEvent} onClick={saveGrant}><Check size={14}/> Grant / update access</button>
      </div>
      <div className="owner-access-organizers"><h3>Organiser status</h3>{organizers.map(organizer => <article className="owner-app" key={organizer.id}>
        <div className="owner-app-top"><div><strong>{organizer.display_name}</strong><span>{organizer.slug} · {organizer.status}</span></div><span className={"status-chip " + (organizer.status === "approved" ? "approved" : "pending")}><span/>{organizer.status.toUpperCase()}</span></div>
        <small>Owner user: {organizer.owner_user_id}</small>
        <div className="owner-app-actions">{organizer.status === "approved" ? <button className="button button-secondary" disabled={busy} onClick={() => changeStatus(organizer, "suspended")}><Shield size={14}/> Suspend access</button> : organizer.status === "suspended" ? <button className="button button-primary" disabled={busy} onClick={() => changeStatus(organizer, "approved")}><Check size={14}/> Restore access</button> : <span className="owner-muted">Pending manual owner approval</span>}</div>
      </article>)}</div>
      <div className="owner-access-organizers"><h3>Event access grants ({activeGrants.length})</h3>{activeGrants.length ? activeGrants.map(grant => <article className="owner-app" key={grant.id}>
        <div className="owner-app-top"><div><strong>{eventForId(grant.event_id)?.title || "Event"}</strong><span>{nameForUser(grant.user_id)} · {grant.access_level}</span></div><span className="status-chip approved"><span/>GRANTED</span></div>
        <small>Granted {new Date(grant.created_at).toLocaleString()}</small>
        <div className="owner-app-actions"><button className="button button-secondary" disabled={busy} onClick={() => revokeGrant(grant)}>Revoke access</button></div>
      </article>) : <p className="owner-muted">No event access grants yet.</p>}</div>
    </>}
  </section>;
}
