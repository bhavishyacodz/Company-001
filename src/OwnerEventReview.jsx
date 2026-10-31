import React, { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, RefreshCw } from "lucide-react";

import { supabase as db } from "./services/supabase/client.js";

export default function OwnerEventReview() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await db
        .from("events")
        .select("id,title,slug,game_title,entry_fee_minor,starts_at,created_at,organizers(display_name,slug)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      setRows(result.data || []);
    } catch (e) {
      setError(e.message || "Could not load the event review queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (row, decision) => {
    const actionLabel = decision === "approved" ? "publish this event" : "return this event to draft";
    if (!window.confirm("Are you sure you want to " + actionLabel + "?")) return;
    setBusy(row.id);
    setError("");
    setNotice("");
    try {
      const result = await db.rpc("review_event_publication", {
        p_event_id: row.id,
        p_decision: decision,
        p_review_note: decision === "approved"
          ? "Approved by platform owner."
          : "Returned to draft for revision."
      });
      if (result.error) throw result.error;
      setNotice(decision === "approved"
        ? "Event approved for publication."
        : "Event returned to draft. It will not be publicly listed.");
      await load();
    } catch (e) {
      setError(e.message || "The event review action failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="owner-card">
      <div className="owner-section-head">
        <div>
          <span className="panel-label">CONTENT MODERATION</span>
          <h2>Events awaiting publication</h2>
          <p>Review event details before approving public visibility. Decisions are processed by the database permission checks.</p>
        </div>
        <button className="button button-secondary" onClick={load} disabled={loading || Boolean(busy)}>
          <RefreshCw size={14} /> {loading ? "Loading…" : "Refresh queue"}
        </button>
      </div>
      {error ? <p className="owner-alert" role="alert">{error}</p> : null}
      {notice ? <p className="account-notice" role="status">{notice}</p> : null}
      {loading ? <p className="owner-muted">Loading the event review queue…</p> : rows.length === 0 ? (
        <div className="owner-empty">
          <CalendarCheck size={23} />
          <strong>You're all caught up.</strong>
          <p>No events are waiting for publication review right now.</p>
        </div>
      ) : (
        <div className="owner-app-list">
          {rows.map(row => (
            <article className="owner-app" key={row.id}>
              <div className="owner-app-top">
                <div>
                  <strong>{row.title || "Untitled event"}</strong>
                  <span>{row.organizers?.display_name || "Organiser"} · /{row.organizers?.slug || "organizer"}/{row.slug}</span>
                </div>
                <span className="status-chip pending"><span />PENDING REVIEW</span>
              </div>
              <p>{row.game_title || "Event"} · Entry fee ₹{((row.entry_fee_minor || 0) / 100).toFixed(2)}</p>
              {row.starts_at ? <p><strong>Scheduled:</strong> {new Date(row.starts_at).toLocaleString()}</p> : null}
              <small>Submitted {row.created_at ? new Date(row.created_at).toLocaleString() : "date unavailable"} · Ref {row.id.slice(0, 8).toUpperCase()}</small>
              <div className="owner-app-actions">
                <button className="button button-primary" disabled={Boolean(busy)} onClick={() => act(row, "approved")}>
                  {busy === row.id ? "Saving…" : <><CheckCircle2 size={14} /> Approve & publish</>}
                </button>
                <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => act(row, "rejected")}>
                  Return to draft
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
