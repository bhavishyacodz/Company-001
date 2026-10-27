import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  "https://zkzgkovwktljfuuuhivk.supabase.co",
  "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB"
);

export default function OwnerPaymentEvidence() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await db
        .from("payment_evidence")
        .select("id,registration_id,organizer_id,review_status,created_at,registrations!payment_evidence_registration_id_fkey(participant_name,participant_email,confirmation_reference,payment_status),organizers!payment_evidence_organizer_id_fkey(display_name,slug)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Could not load payment evidence.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEvidence = async (id) => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) { setError("Your browser blocked the new tab. Allow pop-ups for this site and try again."); return; }
    popup.opener = null;
    setOpening(id);
    setError("");
    try {
      const { data, error: invokeError } = await db.functions.invoke("view-payment-evidence", { body: { evidenceId: id } });
      if (invokeError) throw invokeError;
      if (!data?.signedUrl) throw new Error(data?.error || "Could not open payment evidence.");
      popup.location.href = data.signedUrl;
    } catch (e) {
      if (!popup.closed) popup.close();
      setError(e.message || "Could not open payment evidence.");
    } finally {
      setOpening("");
    }
  };

  return <section className="owner-card">
    <div className="owner-section-head">
      <div><span className="panel-label">PRIVATE PAYMENT EVIDENCE</span><h2>Screenshot review access</h2><p>Only the platform owner and the relevant organiser can open private evidence. Links expire after 60 seconds.</p></div>
      <button className="button button-secondary" onClick={load} disabled={loading}>Refresh</button>
    </div>
    {error ? <p className="owner-alert" role="alert">{error}</p> : null}
    {loading ? <p className="owner-muted">Loading private evidence records…</p> : rows.length === 0 ? <p className="owner-muted">No payment screenshots have been submitted yet.</p> :
      <div className="owner-app-list">{rows.map(row => <article className="owner-app" key={row.id}>
        <div className="owner-app-top"><div><strong>{row.registrations?.participant_name || "Participant"}</strong><span>{row.organizers?.display_name || "Organiser"} · Ref {row.registrations?.confirmation_reference || "—"}</span><small>{row.registrations?.participant_email || ""} · {new Date(row.created_at).toLocaleString()}</small></div><span className="status-chip pending"><span/>{(row.review_status || "pending").replace("_"," ").toUpperCase()}</span></div>
        <p>Payment status: {row.registrations?.payment_status || "pending"} · Evidence is not proof of a successful transfer.</p>
        <div className="owner-app-actions"><button className="button button-primary" disabled={opening === row.id} onClick={() => openEvidence(row.id)}>{opening === row.id ? "Opening…" : "View private screenshot"}</button></div>
      </article>)}</div>}
  </section>;
}
