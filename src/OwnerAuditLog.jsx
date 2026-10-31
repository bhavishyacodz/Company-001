import React, { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Search } from "lucide-react";

import { supabase } from "./services/supabase/client.js";

const actionLabel = action => (action || "activity").replace(/_/g, " ");

export default function OwnerAuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await supabase
        .from("audit_logs")
        .select("id,actor_user_id,organizer_id,action,target_type,target_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(150);
      if (result.error) throw result.error;
      setRows(result.data || []);
    } catch (e) {
      setError(e.message || "Could not load the owner activity log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const actions = useMemo(() => [...new Set(rows.map(row => row.action).filter(Boolean))].sort(), [rows]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => {
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      const searchable = [
        row.action, row.target_type, row.target_id, row.organizer_id,
        row.actor_user_id, JSON.stringify(row.metadata || {})
      ].filter(Boolean).join(" ").toLowerCase();
      return !term || searchable.includes(term);
    });
  }, [rows, search, actionFilter]);

  return (
    <section className="owner-card">
      <div className="owner-section-head">
        <div>
          <span className="panel-label">SECURITY & ACCOUNTABILITY</span>
          <h2><Activity size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Owner activity log</h2>
          <p>Review recorded moderation and access changes. Entries come from the database audit log; this screen does not manufacture events.</p>
        </div>
        <button className="button button-secondary" onClick={load} disabled={loading}><RefreshCw size={14} /> {loading ? "Loading…" : "Refresh log"}</button>
      </div>
      <div className="owner-inbox-controls">
        <label>Search activity
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Action, target ID or organiser ID" aria-label="Search owner activity log" />
        </label>
        <label>Action type
          <select value={actionFilter} onChange={event => setActionFilter(event.target.value)} aria-label="Filter activity by action">
            <option value="all">All recorded actions</option>
            {actions.map(action => <option value={action} key={action}>{actionLabel(action)}</option>)}
          </select>
        </label>
      </div>
      <p className="owner-muted">Newest first · Showing up to 150 recent records. Empty logs are normal before actions have been recorded.</p>
      {error ? <p className="owner-alert" role="alert">{error}</p> : null}
      {loading ? <p className="owner-muted">Loading audit history…</p> : visibleRows.length === 0 ? (
        <div className="owner-empty"><Activity size={23} /><strong>No matching activity records.</strong><p>Try another filter, or refresh after a moderation or access action.</p></div>
      ) : (
        <div className="owner-app-list">
          {visibleRows.map(row => (
            <article className="owner-app" key={row.id}>
              <div className="owner-app-top">
                <div><strong>{actionLabel(row.action)}</strong><span>{row.target_type || "Record"} · {row.target_id ? String(row.target_id).slice(0, 8).toUpperCase() : "No target reference"}</span></div>
                <span className="status-chip approved"><span />RECORDED</span>
              </div>
              <small>{row.created_at ? new Date(row.created_at).toLocaleString() : "Date unavailable"} · Log #{row.id}</small>
              {row.actor_user_id ? <p><strong>Actor:</strong> <code>{row.actor_user_id}</code></p> : null}
              {row.organizer_id ? <p><strong>Organiser:</strong> <code>{row.organizer_id}</code></p> : null}
              {row.metadata && Object.keys(row.metadata).length ? <details><summary>View recorded details</summary><pre className="owner-audit-metadata">{JSON.stringify(row.metadata, null, 2)}</pre></details> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
