import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, Search, Users } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zkzgkovwktljfuuuhivk.supabase.co",
  "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB"
);

const paymentLabels = {
  not_required: "No payment required",
  pending: "Payment pending",
  under_review: "Evidence under review",
  approved: "Paid / approved",
  rejected: "Payment rejected"
};
const registrationLabels = {
  received: "Received",
  confirmed: "Confirmed",
  cancelled: "Cancelled"
};

export default function OwnerRegistrations() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [registrationFilter, setRegistrationFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await supabase
        .from("registrations")
        .select("id,confirmation_reference,participant_name,participant_email,game_id,team_name,payment_status,registration_status,created_at,events!registrations_event_id_fkey(title,slug),organizers!registrations_organizer_id_fkey(display_name,slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (result.error) throw result.error;
      setRows(result.data || []);
    } catch (e) {
      setError(e.message || "Could not load participant registrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => {
      const matchesPayment = paymentFilter === "all" || row.payment_status === paymentFilter;
      const matchesRegistration = registrationFilter === "all" || row.registration_status === registrationFilter;
      const searchable = [
        row.confirmation_reference, row.participant_name, row.participant_email,
        row.game_id, row.team_name, row.events?.title, row.organizers?.display_name, row.id
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesPayment && matchesRegistration && (!term || searchable.includes(term));
    });
  }, [rows, search, paymentFilter, registrationFilter]);

  const pendingPayments = rows.filter(row => ["pending", "under_review"].includes(row.payment_status)).length;
  const confirmed = rows.filter(row => row.registration_status === "confirmed").length;

  return (
    <section className="owner-card">
      <div className="owner-section-head">
        <div>
          <span className="panel-label">PARTICIPANT OPERATIONS</span>
          <h2><ClipboardList size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Registration directory</h2>
          <p>Search participant records across the platform. Payment decisions remain in the secure Payment Evidence workflow.</p>
        </div>
        <button className="button button-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <div className="owner-inbox-summary">
        <div><strong>{rows.length}</strong><span>Recent records loaded</span></div>
        <div><strong>{confirmed}</strong><span>Confirmed</span></div>
        <div><strong>{pendingPayments}</strong><span>Payment attention</span></div>
      </div>
      <div className="owner-inbox-controls">
        <label>Search participants
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, event, team or reference" aria-label="Search participant registrations" />
        </label>
        <label>Payment status
          <select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)} aria-label="Filter by payment status">
            <option value="all">All payment statuses</option>
            <option value="not_required">No payment required</option>
            <option value="pending">Payment pending</option>
            <option value="under_review">Evidence under review</option>
            <option value="approved">Paid / approved</option>
            <option value="rejected">Payment rejected</option>
          </select>
        </label>
        <label>Registration status
          <select value={registrationFilter} onChange={event => setRegistrationFilter(event.target.value)} aria-label="Filter by registration status">
            <option value="all">All registration statuses</option>
            <option value="received">Received</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <p className="owner-muted">Newest first · Up to 200 recent registrations. This view is read-only; use Payment Evidence to review submitted proof.</p>
      {error ? <p className="owner-alert" role="alert">{error}</p> : null}
      {loading ? <p className="owner-muted">Loading participant records…</p> : rows.length === 0 ? (
        <div className="owner-empty"><Users size={23} /><strong>No registrations found yet.</strong><p>Participant records will appear here after event registrations are received.</p></div>
      ) : visibleRows.length === 0 ? (
        <div className="owner-empty"><Search size={23} /><strong>No matching participants.</strong><p>Try a different search or status filter.</p><button className="button button-secondary" onClick={() => { setSearch(""); setPaymentFilter("all"); setRegistrationFilter("all"); }}>Clear filters</button></div>
      ) : (
        <div className="owner-app-list">
          {visibleRows.map(row => (
            <article className="owner-app" key={row.id}>
              <div className="owner-app-top">
                <div><strong>{row.participant_name}</strong><span>{row.participant_email || "No email provided"} · Ref {row.confirmation_reference}</span></div>
                <span className={"status-chip " + (row.registration_status === "confirmed" ? "approved" : row.registration_status === "cancelled" ? "rejected" : "pending")}><span />{(registrationLabels[row.registration_status] || row.registration_status).toUpperCase()}</span>
              </div>
              <p><strong>Event:</strong> {row.events?.title || "Event unavailable"} <span className="owner-muted">· {row.organizers?.display_name || "Organiser unavailable"}</span></p>
              {row.team_name ? <p><strong>Team:</strong> {row.team_name}</p> : null}
              {row.game_id ? <p><strong>Game ID:</strong> {row.game_id}</p> : null}
              <div className="owner-app-actions"><span className={"status-chip " + (row.payment_status === "approved" || row.payment_status === "not_required" ? "approved" : row.payment_status === "rejected" ? "rejected" : "pending")}><span />{paymentLabels[row.payment_status] || row.payment_status}</span>{row.participant_email ? <a className="button button-secondary owner-email-link" href={"mailto:" + encodeURIComponent(row.participant_email) + "?subject=" + encodeURIComponent("Your event registration · " + (row.confirmation_reference || ""))}>Email participant</a> : null}</div>
              <small>Registered {row.created_at ? new Date(row.created_at).toLocaleString() : "date unavailable"} · Record {row.id.slice(0, 8).toUpperCase()}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
