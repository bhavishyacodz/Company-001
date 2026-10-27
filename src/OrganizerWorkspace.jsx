import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, CalendarDays, CirclePlus, ExternalLink, RefreshCw, Save, Users, Gamepad2, Music2, Trophy, GraduationCap, Palette, UsersRound, BookOpen } from "lucide-react";
import "./workspace.css";
const supabase = createClient("https://zkzgkovwktljfuuuhivk.supabase.co","sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB");

const EVENT_TEMPLATES = [
  { key:"esports-001", category:"esports", name:"eSports tournament", label:"eSports", icon:Gamepad2, description:"Gaming brackets, player IDs, squads and entry rules.", title:"Nexus Open Qualifiers", fieldLabel:"GAME / TITLE", fieldPlaceholder:"e.g. BGMI, Valorant, Free Fire", teamSize:4, gameTitle:"BGMI" },
  { key:"garba-001", category:"garba", name:"Garba / Navratri", label:"Garba", icon:Music2, description:"Pass registration, venue details, session timings and dress notes.", title:"Navratri Garba Night", fieldLabel:"EVENT TYPE / SESSION", fieldPlaceholder:"e.g. Family pass, Day 2 evening", teamSize:1, gameTitle:"Garba Night" },
  { key:"sports-001", category:"sports", name:"Sports tournament", label:"Sports", icon:Trophy, description:"Teams, fixtures, venue, age groups and competition rules.", title:"City Champions Cup", fieldLabel:"SPORT / DIVISION", fieldPlaceholder:"e.g. Football U-17, Badminton Open", teamSize:11, gameTitle:"Football" },
  { key:"workshop-001", category:"workshop", name:"Workshop / seminar", label:"Workshop", icon:BookOpen, description:"Seat reservations, agenda, speaker and attendee instructions.", title:"Creative Skills Workshop", fieldLabel:"SESSION / TRACK", fieldPlaceholder:"e.g. Beginner session, Track A", teamSize:1, gameTitle:"Workshop" },
  { key:"coaching-001", category:"coaching", name:"Coaching / classes", label:"Coaching", icon:GraduationCap, description:"Batch enrolment, course level, schedule and contact information.", title:"Foundation Learning Batch", fieldLabel:"COURSE / BATCH", fieldPlaceholder:"e.g. JEE Foundation, Morning batch", teamSize:1, gameTitle:"Coaching class" },
  { key:"cultural-001", category:"cultural", name:"Cultural event", label:"Cultural", icon:Palette, description:"Performances, auditions, participant categories and event schedules.", title:"Rhythm & Culture Fest", fieldLabel:"PERFORMANCE / CATEGORY", fieldPlaceholder:"e.g. Solo dance, Group music", teamSize:1, gameTitle:"Cultural fest" },
  { key:"community-001", category:"community", name:"Community meetup", label:"Community", icon:UsersRound, description:"Meetups, club gatherings, volunteering and community sessions.", title:"Local Creators Meetup", fieldLabel:"GROUP / SESSION", fieldPlaceholder:"e.g. Volunteer, Creator circle", teamSize:1, gameTitle:"Community meetup" }
];
const getTemplate = (key) => EVENT_TEMPLATES.find((item) => item.key === key) || EVENT_TEMPLATES[0];

export default function OrganizerWorkspace({ user, initialView = "organizer", onBack }) {
  const [tab, setTab] = useState(initialView);
  const [organizer, setOrganizer] = useState(null);
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [form, setForm] = useState({template_key:"esports-001",title:"",slug:"",game_title:"",description:"",rules:"",entry_fee:"0",team_size:"1",starts_at:"",registration_closes_at:"",payment_instructions:"",payment_qr_public_url:""});
  const [search, setSearch] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("all");
  const [openingEvidence, setOpeningEvidence] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const { data: org, error: orgError } = await supabase.from("organizers").select("id,display_name,slug,status").eq("owner_user_id", user.id).maybeSingle();
      if (orgError) throw orgError;
      setOrganizer(org || null);
      if (!org) { setEvents([]); setRegistrations([]); return; }
      const [ev, regs] = await Promise.all([
        supabase.from("events").select("id,title,slug,template_key,category,game_title,description,rules,entry_fee_minor,team_size,starts_at,registration_closes_at,payment_instructions,payment_qr_public_url,status,created_at").eq("organizer_id",org.id).order("created_at",{ascending:false}),
        supabase.from("registrations").select("id,event_id,confirmation_reference,participant_name,participant_email,game_id,team_name,payment_status,registration_status,created_at,payment_evidence(id,review_status,created_at)").eq("organizer_id",org.id).order("created_at",{ascending:false}).limit(500)
      ]);
      if (ev.error) throw ev.error;
      if (regs.error) throw regs.error;
      setEvents(ev.data || []); setRegistrations(regs.data || []);
    } catch(e) { setError(e.message || "Could not load your workspace."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user.id]);

  const resetForm = (templateKey = "esports-001") => { const template = getTemplate(templateKey); setEditingId(null); setEditingStatus(null); setForm({template_key:template.key,title:"",slug:"",game_title:template.gameTitle,description:"",rules:"",entry_fee:"0",team_size:String(template.teamSize),starts_at:"",registration_closes_at:"",payment_instructions:"",payment_qr_public_url:""}); };
  const editEvent = (ev) => {
    setEditingId(ev.id);
    setEditingStatus(ev.status);
    setForm({template_key:ev.template_key || "esports-001",title:ev.title || "",slug:ev.slug || "",game_title:ev.game_title || "",description:ev.description || "",rules:ev.rules || "",entry_fee:String((ev.entry_fee_minor || 0)/100),team_size:String(ev.team_size || 1),starts_at:ev.starts_at ? ev.starts_at.slice(0,16) : "",registration_closes_at:ev.registration_closes_at ? ev.registration_closes_at.slice(0,16) : "",payment_instructions:ev.payment_instructions || "",payment_qr_public_url:ev.payment_qr_public_url || ""});
    setTab("customize");
  };
  const update = (key,value) => setForm(old => ({...old,[key]:value}));
  const saveEvent = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!organizer || organizer.status !== "approved") throw new Error("Your organiser account must be approved before creating events.");
      const slug = form.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
      if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) throw new Error("Event slug must be 3–60 characters using lowercase letters, numbers and hyphens.");
      const selectedTemplate = getTemplate(form.template_key);
      const payload = {organizer_id:organizer.id,template_key:selectedTemplate.key,title:form.title.trim(),slug,category:selectedTemplate.category,game_title:form.game_title.trim(),team_format:Number(form.team_size) > 1 ? "team" : "individual",team_size:Math.max(1,Math.min(100,Number(form.team_size)||1)),entry_fee_minor:Math.round(Math.max(0,Number(form.entry_fee)||0)*100),currency:"INR",description:form.description.trim(),rules:form.rules.trim(),starts_at:form.starts_at ? new Date(form.starts_at).toISOString() : null,registration_closes_at:form.registration_closes_at ? new Date(form.registration_closes_at).toISOString() : null,payment_instructions:form.payment_instructions.trim(),payment_qr_public_url:form.payment_qr_public_url.trim(),status:"draft"};
      if (editingId) {
        const nextStatus = editingStatus === "published" ? "pending_review" : editingStatus || "draft";
        const { error: saveError } = await supabase.from("events").update({...payload,status:nextStatus}).eq("id",editingId).eq("organizer_id",organizer.id);
        if (saveError) throw saveError;
        setNotice(editingStatus === "published"
          ? "Changes saved. The event is temporarily unpublished and must pass owner review again."
          : "Event changes saved. Publishing still requires owner approval.");
      } else {
        const { error: saveError } = await supabase.from("events").insert(payload);
        if (saveError) throw saveError;
        setNotice("Event draft created in Supabase.");
      }
      resetForm(); await load(); setTab("organizer");
    } catch(e) { setError(e.message || "Could not save event."); }
    finally { setSaving(false); }
  };
  const requestReview = async (ev) => {
    setError(""); setNotice("");
    try {
      if (ev.status !== "draft" && ev.status !== "closed") throw new Error("Only a draft or closed event can be submitted for review.");
      const { error: updateError } = await supabase.from("events").update({status:"pending_review"}).eq("id",ev.id).eq("organizer_id",organizer.id);
      if (updateError) throw updateError;
      setNotice("Submitted for platform review. It is not public until approved by the platform owner.");
      await load();
    } catch(e) { setError(e.message || "Could not submit event for review."); }
  };
  const openEvidence = async (evidenceId) => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) { setError("Your browser blocked the new tab. Allow pop-ups for this site and try again."); return; }
    popup.opener = null;
    setOpeningEvidence(evidenceId); setError(""); setNotice("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("view-payment-evidence", { body: { evidenceId } });
      if (invokeError) throw invokeError;
      if (!data?.signedUrl) throw new Error(data?.error || "Could not open payment evidence.");
      popup.location.href = data.signedUrl;
      setNotice("Opened a temporary private evidence link. It expires in 60 seconds.");
    } catch (e) {
      if (!popup.closed) popup.close();
      setError(e.message || "Could not open payment evidence.");
    } finally { setOpeningEvidence(""); }
  };

  const updatePayment = async (reg, status) => {
    setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("registrations").update({payment_status:status,registration_status:status === "approved" ? "confirmed" : "received"}).eq("id",reg.id).eq("organizer_id",organizer.id);
      if (updateError) throw updateError;
      setNotice("Registration payment status updated. This does not independently verify a bank transfer.");
      await load();
    } catch(e) { setError(e.message || "Could not update registration."); }
  };

  const visibleRegs = registrations.filter(r => (registrationFilter === "all" || r.payment_status === registrationFilter) && [r.participant_name,r.participant_email,r.game_id,r.team_name,r.confirmation_reference].join(" ").toLowerCase().includes(search.toLowerCase()));
  if (loading) return <main className="workspace-shell"><p>Loading your workspace…</p></main>;
  if (!organizer) return <main className="workspace-shell"><section className="workspace-card"><button className="account-back" onClick={onBack}><ArrowLeft size={14}/> Back</button><div className="section-kicker">COMPANY-001 / ORGANISER</div><h1>Your real workspace starts after approval.</h1><p>Signed in as {user.email}. Submit an organiser application from your account page. After the platform owner approves it, this page will connect to your real events and registrations.</p><button className="button button-primary" onClick={onBack}>Return to website <ArrowRight size={14}/></button></section></main>;
  return <main className="workspace-shell"><div className="workspace-wrap">
    <header className="workspace-heading"><div><div className="section-kicker">COMPANY-001 / EVENT MANAGEMENT</div><h1>{organizer.display_name}</h1><p>Organiser workspace · <code>{organizer.slug}</code> · {organizer.status} · 7 event templates</p></div><div className="workspace-heading-actions"><button className="button button-secondary" onClick={onBack}>Public site <ExternalLink size={14}/></button><button className="button button-secondary" onClick={load}><RefreshCw size={14}/> Refresh</button></div></header>
    <nav className="workspace-tabs"><button className={tab==="organizer"?"active":""} onClick={()=>setTab("organizer")}>Overview</button><button className={tab==="customize"?"active":""} onClick={()=>{resetForm();setTab("customize")}}>Create event</button><button className={tab==="registrations"?"active":""} onClick={()=>setTab("registrations")}>Registrations ({registrations.length})</button></nav>
    {error ? <p className="workspace-alert" role="alert">{error}</p> : null}{notice ? <p className="workspace-notice" role="status">{notice}</p> : null}
    {tab==="organizer" ? <><div className="workspace-metrics"><div><span>EVENTS</span><strong>{events.length}</strong></div><div><span>PUBLISHED</span><strong>{events.filter(e=>e.status==="published").length}</strong></div><div><span>REGISTRATIONS</span><strong>{registrations.length}</strong></div><div><span>PAYMENTS TO REVIEW</span><strong>{registrations.filter(r=>r.payment_status==="pending"||r.payment_status==="under_review").length}</strong></div></div><section className="workspace-card"><div className="workspace-section-head"><div><span className="panel-label">YOUR EVENTS</span><h2>Events and drafts</h2><p>Pick any event type; drafts remain private until the platform owner approves publication.</p></div><button className="button button-primary" onClick={()=>{resetForm();setTab("customize")}}><CirclePlus size={15}/> Create event</button></div>{events.length===0?<div className="workspace-empty"><CalendarDays size={25}/><strong>No events yet</strong><p>Choose a template and create an event draft for your community.</p></div>:<div className="workspace-event-list">{events.map(ev=><article className="workspace-event" key={ev.id}><div><strong>{ev.title}</strong><span>{ev.game_title || "eSports event"} · /{organizer.slug}/{ev.slug}</span><small>{ev.starts_at ? new Date(ev.starts_at).toLocaleString() : "Start date not set"} · ₹{((ev.entry_fee_minor||0)/100).toFixed(2)} entry fee</small></div><span className={"workspace-status status-"+ev.status}>{ev.status.replace("_"," ")}</span><div className="workspace-event-actions"><button className="button button-secondary" onClick={()=>editEvent(ev)}>Edit</button>{ev.status==="draft"||ev.status==="closed"?<button className="button button-primary" onClick={()=>requestReview(ev)}>Submit for review <ArrowRight size={13}/></button>:null}</div></article>)}</div>}</section></>:null}
    {tab==="customize" ? <section className="workspace-card"><div className="workspace-section-head"><div><span className="panel-label">EVENT BUILDER</span><h2>{editingId?"Edit event draft":"Create an event draft"}</h2><p>Choose a starting layout, then customise the details. Every new event stays private until submitted and approved.</p></div></div><div className="template-gallery" aria-label="Choose an event template">{EVENT_TEMPLATES.map((template) => { const Icon = template.icon; return <button type="button" key={template.key} className={form.template_key===template.key?"template-choice selected":"template-choice"} onClick={() => { if (editingId) return; const nextSlug = template.key.replace(/-001$/,""); setForm(old => ({...old,template_key:template.key,title:template.title,slug:nextSlug,game_title:template.gameTitle,team_size:String(template.teamSize)})); }} disabled={Boolean(editingId)}><span className="template-choice-icon"><Icon size={18}/></span><strong>{template.name}</strong><small>{template.description}</small><span className="template-choice-action">{form.template_key===template.key?"Selected":"Use template"}</span></button>; })}</div><div className="template-sample-note"><strong>Included starter examples</strong><span>Garba night · Football cup · Creative workshop · Coaching batch · Cultural fest · Community meetup · eSports qualifiers</span></div><form className="workspace-form" onSubmit={saveEvent}><label>EVENT TITLE<input required minLength="2" maxLength="140" value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Nexus Open Qualifiers"/></label><label>PUBLIC URL SLUG<input required minLength="3" maxLength="60" value={form.slug} onChange={e=>update("slug",e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,"-"))} placeholder="nexus-open-qualifiers"/></label><label>{getTemplate(form.template_key).fieldLabel}<input value={form.game_title} onChange={e=>update("game_title",e.target.value)} placeholder={getTemplate(form.template_key).fieldPlaceholder}/></label><label>ENTRY FEE (₹)<input type="number" min="0" step="1" value={form.entry_fee} onChange={e=>update("entry_fee",e.target.value)}/></label><label>TEAM SIZE<input type="number" min="1" max="100" value={form.team_size} onChange={e=>update("team_size",e.target.value)}/></label><label>EVENT START<input type="datetime-local" value={form.starts_at} onChange={e=>update("starts_at",e.target.value)}/></label><label>REGISTRATION CLOSES<input type="datetime-local" value={form.registration_closes_at} onChange={e=>update("registration_closes_at",e.target.value)}/></label><label className="workspace-wide">DESCRIPTION<textarea rows="3" value={form.description} onChange={e=>update("description",e.target.value)}/></label><label className="workspace-wide">RULES<textarea rows="3" value={form.rules} onChange={e=>update("rules",e.target.value)}/></label><label className="workspace-wide">PAYMENT INSTRUCTIONS (FOR PAID EVENTS)<textarea rows="2" value={form.payment_instructions} onChange={e=>update("payment_instructions",e.target.value)} placeholder="Explain how participants pay you directly."/></label><label className="workspace-wide">PUBLIC PAYMENT QR IMAGE URL<input type="url" value={form.payment_qr_public_url} onChange={e=>update("payment_qr_public_url",e.target.value)} placeholder="https://…"/></label><div className="workspace-form-note">Participant payments go directly to the organiser. Screenshot uploads are evidence for manual review, not proof that money was received.</div><div className="workspace-form-actions"><button type="button" className="button button-secondary" onClick={()=>{resetForm();setTab("organizer")}}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?"Saving…":<><Save size={14}/> Save draft</>}</button></div></form></section>:null}
    {tab==="registrations" ? <section className="workspace-card"><div className="workspace-section-head"><div><span className="panel-label">PARTICIPANTS</span><h2>Registration records</h2><p>Private records visible only to this organiser and authorised platform owners.</p></div></div><div className="workspace-reg-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, team, game ID or reference"/><select value={registrationFilter} onChange={e=>setRegistrationFilter(e.target.value)}><option value="all">All payment states</option><option value="pending">Pending</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="not_required">Not required</option></select></div>{visibleRegs.length===0?<div className="workspace-empty"><Users size={24}/><strong>No matching registrations</strong><p>Real registrations will appear here after someone submits a published event form.</p></div>:<div className="workspace-reg-list">{visibleRegs.map(r=><article className="workspace-reg" key={r.id}><div><strong>{r.participant_name}</strong><span>{r.participant_email} · {r.team_name||"Solo"} · UID {r.game_id||"—"}</span><small>Ref {r.confirmation_reference} · {new Date(r.created_at).toLocaleString()}</small></div><span className={"workspace-status status-"+r.payment_status}>{r.payment_status.replace("_"," ")}</span><div className="workspace-reg-actions">{r.payment_evidence?.[0]?<button className="button button-secondary" disabled={openingEvidence===r.payment_evidence[0].id} onClick={()=>openEvidence(r.payment_evidence[0].id)}>{openingEvidence===r.payment_evidence[0].id?"Opening evidence…":"View payment screenshot"}</button>:null}{r.payment_status!=="approved"?<button className="button button-primary" onClick={()=>updatePayment(r,"approved")}>Mark payment approved</button>:null}{r.payment_status!=="rejected"?<button className="button button-secondary" onClick={()=>updatePayment(r,"rejected")}>Reject payment</button>:null}</div></article>)}</div>}</section>:null}
    <p className="workspace-footnote">Signed in as {user.email}. Payment status changes are administrative labels; verify the actual transfer independently before confirming payment.</p>
  </div></main>;
}
