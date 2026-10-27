import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, Users } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import OwnerEventReview from "./OwnerEventReview.jsx";
import OwnerPaymentEvidence from "./OwnerPaymentEvidence.jsx";

const supabase = createClient(
  "https://zkzgkovwktljfuuuhivk.supabase.co",
  "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB"
);

export default function OwnerPanel({ onBack }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [applications, setApplications] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [counts, setCounts] = useState({ events: 0, registrations: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUser = sessionData.session && sessionData.session.user;
      if (!currentUser) { setUser(null); setRole(null); return; }
      setUser(currentUser);
      const { data: profile, error: profileError } = await supabase.from("profiles").select("platform_role").eq("id", currentUser.id).maybeSingle();
      if (profileError) throw profileError;
      setRole((profile && profile.platform_role) || "organizer");
      if (!profile || profile.platform_role !== "owner") return;
      const [appResult, organizerResult, eventResult, registrationResult] = await Promise.all([
        supabase.from("organizer_applications").select("id,applicant_user_id,business_name,category,contact_email,notes,status,decision_note,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("organizers").select("id,owner_user_id,display_name,slug,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("registrations").select("id", { count: "exact", head: true })
      ]);
      if (appResult.error) throw appResult.error;
      if (organizerResult.error) throw organizerResult.error;
      if (eventResult.error) throw eventResult.error;
      if (registrationResult.error) throw registrationResult.error;
      setApplications(appResult.data || []);
      setOrganizers(organizerResult.data || []);
      setCounts({ events: eventResult.count || 0, registrations: registrationResult.count || 0 });
    } catch (e) {
      setError(e.message || "Could not load the owner workspace.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const review = async (app, decision) => {
    setBusyId(app.id); setError(""); setNotice("");
    try {
      const base = (app.business_name || "organizer").toLowerCase()
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 38) || "organizer";
      const slug = (base + "-" + app.id.replace(/-/g, "").slice(0, 6)).slice(0, 50).replace(/-+$/g, "");
      const { data, error: rpcError } = await supabase.rpc("review_organizer_application", {
        p_application_id: app.id,
        p_decision: decision,
        p_decision_note: decision === "rejected" ? "Application declined by platform owner." : "Approved for Template 001 · eSports.",
        p_organizer_slug: decision === "approved" ? slug : ""
      });
      if (rpcError) throw rpcError;
      setNotice(decision === "approved" ? "Organiser approved. Workspace created: " + ((data && data.organizer_slug) || slug) : "Application rejected.");
      await load();
    } catch (e) {
      setError(e.message || "Review action failed.");
    } finally { setBusyId(""); }
  };

  if (!user) return <main className="owner-shell"><section className="owner-card"><button className="account-back" onClick={onBack}>← Back to website</button><h1>Owner sign-in required.</h1><p>Sign in with your platform-owner account, then open the owner workspace.</p><button className="button button-primary" onClick={onBack}>Back to website <ArrowRight size={15} /></button></section></main>;
  if (role !== "owner") return <main className="owner-shell"><section className="owner-card"><button className="account-back" onClick={onBack}>← Back to website</button><div className="section-kicker">COMPANY-001 / RESTRICTED</div><h1>Owner access required.</h1><p>Your signed-in account does not have the platform-owner role. This screen cannot grant owner access to itself.</p><p className="owner-muted">To bootstrap the first owner, set platform_role to owner for your own verified user in Supabase SQL Editor, using your Auth user UUID. Never expose service-role credentials in the website.</p></section></main>;

  const visibleApplications = applications.filter(a => filter === "all" || a.status === filter);
  return (
    <main className="owner-shell">
      <div className="owner-wrap">
        <header className="owner-heading"><div><div className="section-kicker">COMPANY-001 / PRIVATE CONTROL ROOM</div><h1>Platform overview.</h1><p>Review organiser applications and keep the platform accountable.</p></div><button className="button button-secondary" onClick={onBack}>Public site <ExternalLink size={14} /></button></header>
        <div className="owner-metrics">
          <div className="owner-metric"><span>ORGANISER APPLICATIONS</span><strong>{applications.length}</strong><small>All recorded applications</small></div>
          <div className="owner-metric"><span>APPROVED ORGANISERS</span><strong>{organizers.filter(o => o.status === "approved").length}</strong><small>Active organiser accounts</small></div>
          <div className="owner-metric"><span>EVENTS</span><strong>{counts.events}</strong><small>Database records</small></div>
          <div className="owner-metric"><span>REGISTRATIONS</span><strong>{counts.registrations}</strong><small>Participant records</small></div>
        </div>
        <section className="owner-card">
          <div className="owner-section-head"><div><span className="panel-label">ACCESS CONTROL</span><h2>Organiser applications</h2><p>Approval creates an organiser workspace in one database transaction.</p></div><button className="button button-secondary" onClick={load} disabled={loading}><ArrowRight size={14} /> Refresh</button></div>
          <div className="owner-filters">{["pending","approved","rejected","all"].map(f => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div>
          {loading ? <p className="owner-muted">Loading platform records…</p> : visibleApplications.length === 0 ? <div className="owner-empty"><Users size={23} /><strong>No applications in this view.</strong><p>New organiser requests will appear here when submitted.</p></div> : <div className="owner-app-list">{visibleApplications.map(app => <article className="owner-app" key={app.id}><div className="owner-app-top"><div><strong>{app.business_name}</strong><span>{app.contact_email} · {app.category}</span></div><span className={"status-chip " + (app.status === "approved" ? "approved" : "pending")}><span />{app.status.toUpperCase()}</span></div><p>{app.notes || "No extra notes provided."}</p><small>Submitted {new Date(app.created_at).toLocaleString()}</small>{app.status === "pending" ? <div className="owner-app-actions"><button className="button button-primary" disabled={busyId === app.id} onClick={() => review(app,"approved")}>{busyId === app.id ? "Working…" : "Approve & create workspace"} <Check size={14} /></button><button className="button button-secondary" disabled={busyId === app.id} onClick={() => review(app,"rejected")}>Reject</button></div> : app.decision_note ? <div className="owner-decision">Decision note: {app.decision_note}</div> : null}</article>)}</div>}
        </section>
        <OwnerEventReview />
        <OwnerPaymentEvidence />
        <section className="owner-card"><div className="owner-section-head"><div><span className="panel-label">TENANT DIRECTORY</span><h2>Organisers</h2><p>Quick visibility into approved, pending and suspended workspaces.</p></div></div>{organizers.length === 0 ? <p className="owner-muted">No organiser workspaces have been created yet.</p> : <div className="owner-table-wrap"><table><thead><tr><th>ORGANISER</th><th>PUBLIC SLUG</th><th>STATUS</th></tr></thead><tbody>{organizers.map(o => <tr key={o.id}><td>{o.display_name}</td><td><code>{o.slug}</code></td><td><span className={"status-chip " + (o.status === "approved" ? "approved" : "pending")}><span />{o.status}</span></td></tr>)}</tbody></table></div>}</section>
        {error ? <p className="owner-alert" role="alert">{error}</p> : null}
        {notice ? <p className="account-notice" role="status">{notice}</p> : null}
        <p className="owner-muted">Signed in as {user.email}. Owner actions are checked by Supabase, not just by this screen.</p>
      </div>
    </main>
  );
}
