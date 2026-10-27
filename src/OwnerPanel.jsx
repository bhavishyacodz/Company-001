import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, Users, LayoutDashboard, Inbox, UserCheck, CalendarCheck, CreditCard, Shield, RefreshCw, Building2, ShieldCheck, ClipboardList } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import OwnerEventReview from "./OwnerEventReview.jsx";
import OwnerPaymentEvidence from "./OwnerPaymentEvidence.jsx";
import OwnerRegistrations from "./OwnerRegistrations.jsx";
import OrganizerAccessPanel from "./OrganizerAccessPanel.jsx";

const supabase = createClient(
  "https://zkzgkovwktljfuuuhivk.supabase.co",
  "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB"
);

export default function OwnerPanel({ onBack }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [applications, setApplications] = useState([]);
  const [consultationRequests, setConsultationRequests] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [counts, setCounts] = useState({ events: 0, registrations: 0, pendingEvents: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");
  const [consultationFilter, setConsultationFilter] = useState("all");
  const [consultationSearch, setConsultationSearch] = useState("");

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
      const [appResult, organizerResult, eventResult, registrationResult, consultationResult, pendingEventResult] = await Promise.all([
        supabase.from("organizer_applications").select("id,applicant_user_id,business_name,category,contact_email,notes,status,decision_note,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("organizers").select("id,owner_user_id,display_name,slug,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("registrations").select("id", { count: "exact", head: true }),
        supabase.from("consultation_requests").select("id,name,email,phone,project_type,requirements,preferred_time,status,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review")
      ]);
      if (appResult.error) throw appResult.error;
      if (organizerResult.error) throw organizerResult.error;
      if (eventResult.error) throw eventResult.error;
      if (registrationResult.error) throw registrationResult.error;
      if (consultationResult.error) throw consultationResult.error;
      if (pendingEventResult.error) throw pendingEventResult.error;
      setConsultationRequests(consultationResult.data || []);
      setApplications(appResult.data || []);
      setOrganizers(organizerResult.data || []);
      setCounts({ events: eventResult.count || 0, registrations: registrationResult.count || 0, pendingEvents: pendingEventResult.count || 0 });
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
        p_decision_note: decision === "rejected" ? "Application declined by platform owner." : "Approved for category: " + (app.category || "esports") + ".",
        p_organizer_slug: decision === "approved" ? slug : ""
      });
      if (rpcError) throw rpcError;
      setNotice(decision === "approved" ? "Organiser approved. Workspace created: " + ((data && data.organizer_slug) || slug) : "Application rejected.");
      await load();
    } catch (e) {
      setError(e.message || "Review action failed.");
    } finally { setBusyId(""); }
  };

  const updateConsultationStatus = async (request, status) => {
    if (!["new", "contacted", "qualified", "quoted", "closed"].includes(status) || request.status === status) return;
    setBusyId(request.id); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("consultation_requests").update({ status }).eq("id", request.id);
      if (updateError) throw updateError;
      setConsultationRequests(current => current.map(item => item.id === request.id ? { ...item, status } : item));
      setNotice("Enquiry status updated.");
    } catch (e) {
      setError(e.message || "Could not update enquiry status.");
    } finally { setBusyId(""); }
  };

  if (!user) return <main className="owner-shell"><section className="owner-card"><button className="account-back" onClick={onBack}>← Back to website</button><h1>Owner sign-in required.</h1><p>Sign in with your platform-owner account, then open the owner workspace.</p><button className="button button-primary" onClick={onBack}>Back to website <ArrowRight size={15} /></button></section></main>;
  if (role !== "owner") return <main className="owner-shell"><section className="owner-card"><button className="account-back" onClick={onBack}>← Back to website</button><div className="section-kicker">COMPANY-001 / RESTRICTED</div><h1>Owner access required.</h1><p>Your signed-in account does not have the platform-owner role. This screen cannot grant owner access to itself.</p><p className="owner-muted">To bootstrap the first owner, set platform_role to owner for your own verified user in Supabase SQL Editor, using your Auth user UUID. Never expose service-role credentials in the website.</p></section></main>;

  const visibleApplications = applications.filter(a => filter === "all" || a.status === filter);
  const normalizedConsultationSearch = consultationSearch.trim().toLowerCase();
  const visibleConsultationRequests = consultationRequests.filter(request => {
    const matchesStatus = consultationFilter === "all" || request.status === consultationFilter;
    const searchable = [request.name, request.email, request.phone, request.requirements, request.project_type, request.id].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && (!normalizedConsultationSearch || searchable.includes(normalizedConsultationSearch));
  });
  const newConsultationCount = consultationRequests.filter(request => request.status === "new").length;
  return (
    <main className="owner-shell">
      <div className="owner-wrap">
        <header className="owner-heading"><div><div className="section-kicker owner-live-kicker"><span className="owner-live-dot" /> COMPANY-001 / KING CONTROL ROOM</div><h1>Good to have you back.</h1><p>Your platform command centre. Review activity, manage access, approve events and keep everything organised from one place.</p></div><div className="owner-heading-actions"><span className="owner-secure-label"><ShieldCheck size={14}/> OWNER ACCESS</span><button className="button button-secondary" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh data</button><button className="button button-secondary" onClick={onBack}>Public site <ExternalLink size={14} /></button></div></header>
        <nav className="owner-command-nav" aria-label="Owner dashboard sections">
          <a href="#owner-overview"><LayoutDashboard size={16}/><span>Overview</span></a>
          <a href="#owner-enquiries"><Inbox size={16}/><span>Enquiries</span><b>{newConsultationCount}</b></a>
          <a href="#owner-applications"><UserCheck size={16}/><span>Organiser approvals</span><b>{applications.filter(a => a.status === "pending").length}</b></a>
          <a href="#owner-access"><Shield size={16}/><span>Access control</span></a>
          <a href="#owner-events"><CalendarCheck size={16}/><span>Event publishing</span><b>{counts.pendingEvents}</b></a>
          <a href="#owner-registrations"><ClipboardList size={16}/><span>Registrations</span><b>{counts.registrations}</b></a>
          <a href="#owner-payments"><CreditCard size={16}/><span>Payments</span></a>
          <a href="#owner-organisers"><Building2 size={16}/><span>Organisers</span></a>
        </nav>
        <section id="owner-overview" className="owner-overview-intro"><div><span className="panel-label">YOUR DAILY CHECKLIST</span><h2>Everything important, in one place.</h2><p>Use the shortcuts below instead of scrolling through the whole dashboard.</p></div><div className="owner-overview-status"><span className="owner-live-dot"/> <span>Secure owner session</span></div></section>
        <div className="owner-metrics">
          <div className="owner-metric"><span>ORGANIZER WORKSPACES</span><strong>{organizers.length}</strong><small>Active and suspended accounts</small></div>
          <div className="owner-metric"><span>APPROVED ORGANISERS</span><strong>{organizers.filter(o => o.status === "approved").length}</strong><small>Active organiser accounts</small></div>
          <div className="owner-metric"><span>EVENTS TO REVIEW</span><strong>{counts.pendingEvents}</strong><small>Awaiting publication decision</small></div>
          <div className="owner-metric"><span>ALL EVENTS</span><strong>{counts.events}</strong><small>Total event records</small></div>
          <div className="owner-metric"><span>REGISTRATIONS</span><strong>{counts.registrations}</strong><small>Participant records</small></div>
        </div>
        <section id="owner-enquiries" className="owner-card">
          <div className="owner-section-head"><div><span className="panel-label">01 / CUSTOMER PIPELINE</span><h2>Consultation enquiries</h2><p>Private inbox for website, landing-page, dashboard and digital-tool requests.</p></div><button className="button button-secondary" onClick={load} disabled={loading}><ArrowRight size={14} /> Refresh</button></div>
          <div className="owner-inbox-summary">
            <div><strong>{consultationRequests.length}</strong><span>Total enquiries</span></div>
            <div><strong>{newConsultationCount}</strong><span>Need first response</span></div>
            <div><strong>{consultationRequests.filter(request => request.status === "quoted").length}</strong><span>Quote sent</span></div>
          </div>
          <div className="owner-inbox-controls">
            <label>Search enquiries<input type="search" value={consultationSearch} onChange={event => setConsultationSearch(event.target.value)} placeholder="Name, email, project or reference" aria-label="Search consultation enquiries" /></label>
            <label>Filter by status<select value={consultationFilter} onChange={event => setConsultationFilter(event.target.value)} aria-label="Filter consultation enquiries by status"><option value="all">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="quoted">Quoted</option><option value="closed">Closed</option></select></label>
          </div>
          <p className="owner-muted">Newest first · Showing up to 100 recent enquiries. Use the status to track each step of follow-up.</p>
          {loading ? <p className="owner-muted">Loading enquiries…</p> : consultationRequests.length === 0 ? <div className="owner-empty"><Users size={23} /><strong>No consultation enquiries yet.</strong><p>Once a customer submits the public form, their enquiry will appear here. This inbox is private to the platform owner.</p></div> : visibleConsultationRequests.length === 0 ? <div className="owner-empty"><Users size={23} /><strong>No matching enquiries.</strong><p>Try a different search or status filter.</p><button className="button button-secondary" onClick={() => { setConsultationSearch(""); setConsultationFilter("all"); }}>Clear filters</button></div> : <div className="owner-app-list">{visibleConsultationRequests.map(request => <article className="owner-app" key={request.id}>
            <div className="owner-app-top"><div><strong>{request.name}</strong><span>{request.email}{request.phone ? " · " + request.phone : ""}</span></div><span className={"status-chip " + (request.status === "closed" ? "approved" : "pending")}><span />{request.status.toUpperCase()}</span></div>
            <p><strong>Project:</strong> {({"business-website":"Business website","landing-page":"Landing page","web-app":"Web app","dashboard":"Dashboard","event-platform":"Event platform",other:"Other"}[request.project_type] || request.project_type)}</p>
            <p>{request.requirements}</p>
            {request.preferred_time ? <p><strong>Preferred contact time:</strong> {request.preferred_time}</p> : null}
            <small>Received {new Date(request.created_at).toLocaleString()} · Ref {request.id.slice(0,8).toUpperCase()}</small>
            <div className="owner-app-actions"><a className="button button-secondary owner-email-link" href={"mailto:" + encodeURIComponent(request.email) + "?subject=" + encodeURIComponent("Your Company-001 project enquiry")}>Reply by email <ExternalLink size={13}/></a><label className="owner-muted">Status <select aria-label={"Status for enquiry from " + request.name} value={request.status} disabled={busyId === request.id} onChange={event => updateConsultationStatus(request,event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="quoted">Quoted</option><option value="closed">Closed</option></select></label></div>
          </article>)}</div>}
        </section>
        <section id="owner-applications" className="owner-card">
          <div className="owner-section-head">
            <div><span className="panel-label">02 / ORGANISER ONBOARDING</span><h2>Organiser applications</h2><p>Review each application before creating an organiser workspace. Approval and rejection are enforced by Supabase.</p></div>
            <label className="owner-muted">Filter applications
              <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter organiser applications">
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All applications</option>
              </select>
            </label>
          </div>
          <p className="owner-muted">Showing {visibleApplications.length} of {applications.length} recent applications · Newest first.</p>
          {loading ? <p className="owner-muted">Loading organiser applications…</p> : visibleApplications.length === 0 ? (
            <div className="owner-empty"><Users size={23} /><strong>No applications in this view.</strong><p>New applications will appear here after organisers submit the signup form.</p></div>
          ) : (
            <div className="owner-app-list">{visibleApplications.map(app => (
              <article className="owner-app" key={app.id}>
                <div className="owner-app-top">
                  <div><strong>{app.business_name}</strong><span>{app.contact_email || "No contact email"} · {(app.category || "other").replace(/-/g, " ")}</span></div>
                  <span className={"status-chip " + (app.status === "approved" ? "approved" : app.status === "pending" ? "pending" : "rejected")}><span />{app.status.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                {app.notes ? <p>{app.notes}</p> : null}
                <small>Submitted {new Date(app.created_at).toLocaleString()} · Ref {app.id.slice(0, 8).toUpperCase()}</small>
                {app.status === "pending" ? (
                  <div className="owner-app-actions">
                    <button className="button button-primary" disabled={busyId === app.id} onClick={() => review(app, "approved")}>{busyId === app.id ? "Reviewing…" : "Approve organiser"} <Check size={14}/></button>
                    <button className="button button-secondary" disabled={busyId === app.id} onClick={() => review(app, "rejected")}>{busyId === app.id ? "Reviewing…" : "Reject application"}</button>
                  </div>
                ) : app.decision_note ? <p className="owner-muted"><strong>Decision:</strong> {app.decision_note}</p> : null}
              </article>
            ))}</div>
          )}
        </section>
        <section id="owner-access" className="owner-module-anchor"><div className="owner-module-heading"><span className="panel-label">03 / PERMISSIONS</span><h2>Access control</h2><p>Give organisers the right level of access, or revoke it when needed.</p></div><OrganizerAccessPanel currentUser={user} /></section>
        <section id="owner-events" className="owner-module-anchor"><div className="owner-module-heading"><span className="panel-label">04 / CONTENT OPERATIONS</span><h2>Event publishing</h2><p>Review submitted events before they become visible to the public.</p></div><OwnerEventReview /></section>
        <section id="owner-registrations" className="owner-module-anchor"><div className="owner-module-heading"><span className="panel-label">05 / PARTICIPANT OPERATIONS</span><h2>Registrations</h2><p>Find participants and check registration and payment status across events.</p></div><OwnerRegistrations /></section>
        <section id="owner-payments" className="owner-module-anchor"><div className="owner-module-heading"><span className="panel-label">06 / PAYMENT OPERATIONS</span><h2>Payment evidence</h2><p>Review submitted payment evidence securely.</p></div><OwnerPaymentEvidence /></section>
        <section id="owner-organisers" className="owner-card"><div className="owner-section-head"><div><span className="panel-label">07 / WORKSPACE DIRECTORY</span><h2>Organisers</h2><p>Quick visibility into active and suspended workspaces.</p></div></div>{organizers.length === 0 ? <p className="owner-muted">No organiser workspaces have been created yet.</p> : <div className="owner-table-wrap"><table><thead><tr><th>ORGANISER</th><th>PUBLIC SLUG</th><th>STATUS</th></tr></thead><tbody>{organizers.map(o => <tr key={o.id}><td>{o.display_name}</td><td><code>{o.slug}</code></td><td><span className={"status-chip " + (o.status === "approved" ? "approved" : "pending")}><span />{o.status}</span></td></tr>)}</tbody></table></div>}</section>
        {error ? <p className="owner-alert" role="alert">{error}</p> : null}
        {notice ? <p className="account-notice" role="status">{notice}</p> : null}
        <p className="owner-muted">Signed in as {user.email}. Owner actions are checked by Supabase, not just by this screen.</p>
      </div>
    </main>
  );
}
