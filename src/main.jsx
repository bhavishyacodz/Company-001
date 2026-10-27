import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownRight, ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Copy, Gamepad2, Globe2, ImagePlus, LayoutDashboard,
  Menu, ShieldCheck, Sparkles, Swords, Trophy, Users, WalletCards, X,
  Zap, Settings2, ExternalLink
} from "lucide-react";
import "./styles.css";

const sampleRegistrations = [
  { name: "ShadowByte", team: "NOVA", gameId: "SB-2048", status: "Pending review", tone: "pending" },
  { name: "KairoX", team: "Solo", gameId: "KX-1109", status: "Verified", tone: "approved" },
  { name: "NeonRift", team: "PHANTOM", gameId: "NR-8821", status: "Pending review", tone: "pending" }
];

function App() {
  const [view, setView] = useState("site");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [eventName, setEventName] = useState("NEXUS OPEN");
  const [organizerName, setOrganizerName] = useState("Nexus Esports");
  const [accent, setAccent] = useState("violet");
  const [submitted, setSubmitted] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [gameId, setGameId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [copied, setCopied] = useState(false);
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [liveConfirmation, setLiveConfirmation] = useState(null);
  const [eventData, setEventData] = useState(null);
  const routeParts = window.location.pathname.split("/").filter(Boolean);
  const routeSlugs = routeParts[0] === "Company-001" ? routeParts.slice(1) : routeParts;
  const isLiveEventRoute = routeSlugs.length === 2;
  const organizerSlug = isLiveEventRoute ? routeSlugs[0] : "";
  const eventSlug = isLiveEventRoute ? routeSlugs[1] : "";
  const supabaseUrl = "https://zkzgkovwktljfuuuhivk.supabase.co";
  const supabasePublishableKey = "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB";

  useEffect(() => {
    if (!isLiveEventRoute) return;
    const query = new URLSearchParams({
      select: "id,title,category,game_title,team_format,team_size,entry_fee_minor,prize_pool_label,description,rules,starts_at,registration_closes_at,payment_instructions,payment_qr_public_url,organizers!inner(slug,display_name,status)",
      slug: "eq." + eventSlug,
      "organizers.slug": "eq." + organizerSlug,
      status: "eq.published",
      "organizers.status": "eq.approved",
    });
    fetch(supabaseUrl + "/rest/v1/events?" + query.toString(), { headers: { apikey: supabasePublishableKey } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this event.");
        const rows = await response.json();
        if (!rows.length) throw new Error("This event page is not published or is unavailable.");
        const item = rows[0];
        setEventData(item);
        setEventName(item.title || "Tournament");
        setOrganizerName(item.organizers?.display_name || "Event organiser");
      })
      .catch((error) => setSubmissionError(error.message || "Could not load this event."));
  }, [isLiveEventRoute, organizerSlug, eventSlug]);

  const openRegister = () => {
    setRegisterOpen(true);
    setSubmitted(false);
    window.setTimeout(() => document.getElementById("registration")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  const submitDemo = async (event) => {
    event.preventDefault();
    setSubmissionError("");
    setLiveConfirmation(null);
    if (!isLiveEventRoute) {
      setSubmitted(true);
      return;
    }
    if (!eventData) {
      setSubmissionError("This event is not ready to accept registrations.");
      return;
    }
    setIsSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      form.set("organizer_slug", organizerSlug);
      form.set("event_slug", eventSlug);
      form.set("participant_name", playerName);
      form.set("participant_email", playerEmail);
      form.set("game_id", gameId);
      form.set("team_name", teamName);
      form.set("website", "");
      if (paymentScreenshot) form.set("payment_screenshot", paymentScreenshot);
      const response = await fetch(supabaseUrl + "/functions/v1/register-esports", {
        method: "POST",
        headers: { apikey: supabasePublishableKey },
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Registration failed. Please try again.");
      setLiveConfirmation(result);
      setSubmitted(true);
    } catch (error) {
      setSubmissionError(error.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyDemoLink = async () => {
    try {
      await navigator.clipboard.writeText("https://company-001.example/nexus/nexus-open");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`app accent-${accent}`}>
      <div className="prototype-banner">
        <span className="prototype-dot" />
        <span><strong>EARLY PREVIEW</strong> · Sample data only — live registrations and uploads aren't connected yet.</span>
        <button className="banner-link" onClick={() => setView(view === "site" ? "organizer" : "site")}>
          {view === "site" ? "See organiser panel" : "Back to public page"} <ArrowRight size={14} />
        </button>
      </div>

      <header className="topbar">
        <button className="brand" onClick={() => setView("site")} aria-label="ARENA home">
          <span className="brand-mark"><Swords size={19} strokeWidth={2.5} /></span>
          <span className="brand-word">ARENA<span className="brand-period">.</span><small>POWERED BY COMPANY-001</small></span>
        </button>
        <nav className={mobileMenu ? "nav-links nav-open" : "nav-links"}>
          {view === "site" ? <>
            <a href="#overview" onClick={() => setMobileMenu(false)}>Overview</a>
            <a href="#format" onClick={() => setMobileMenu(false)}>Tournament</a>
            <a href="#rules" onClick={() => setMobileMenu(false)}>Rules</a>
          </> : <>
            <button className="nav-text active" onClick={() => setView("organizer")}>Overview</button>
            <button className="nav-text" onClick={() => setView("customize")}>Customize</button>
            <button className="nav-text" onClick={() => setView("registrations")}>Registrations</button>
          </>}
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
          <button className="avatar" onClick={() => setView(view === "site" ? "organizer" : "site")} aria-label="Open organiser preview">N</button>
          <button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      {view === "site" ? (
        <main>
          <section className="hero" id="overview">
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="eyebrow"><span className="live-pip" /> REGISTRATION OPEN <span className="eyebrow-line" /> SEASON 01</div>
              <h1>YOUR NEXT<br /><span className="gradient-text">VICTORY</span> STARTS HERE.</h1>
              <p className="hero-copy">{eventData?.description || "One arena. One shot at glory. Join the open tournament built for the next generation of competitors."}</p>
              <div className="hero-buttons">
                <button className="button button-primary" onClick={openRegister}>Register for tournament <ArrowRight size={17} /></button>
                <a className="button button-quiet" href="#format">Explore event <ArrowDownRight size={17} /></a>
              </div>
              <div className="hero-trust"><span><ShieldCheck size={15} /> Organiser-managed event</span><span><Zap size={15} /> Fast registration</span></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-ring ring-three" />
              <div className="art-cross cross-one" /><div className="art-cross cross-two" />
              <div className="art-core"><Swords size={96} strokeWidth={1.1} /></div>
              <div className="art-label label-top"><span className="label-dot" /> OPEN QUALIFIERS</div>
              <div className="art-label label-bottom"><Trophy size={16} /> COMPETE FOR THE CROWN</div>
              <div className="art-coordinate">22°43' N<br />75°51' E</div>
            </div>
            <div className="hero-index"><span>01</span> / 04</div>
          </section>

          <section className="ticker" aria-label="Tournament highlights">
            <div><Trophy size={17} /><span>REWARDS</span><strong>Badges & recognition</strong></div>
            <i />
            <div><Users size={17} /><span>FORMAT</span><strong>Squad & Solo</strong></div>
            <i />
            <div><CalendarDays size={17} /><span>REGISTRATION CLOSES</span><strong>30 NOV · 8:00 PM</strong></div>
            <i />
            <div><Gamepad2 size={17} /><span>GAME</span><strong>Choose your game</strong></div>
          </section>

          <section className="section event-section" id="format">
            <div className="section-heading">
              <div><div className="section-kicker">THE MISSION</div><h2>BUILT FOR THE <span className="gradient-text">COMPETITIVE.</span></h2></div>
              <p>Everything you need to know before you drop in. Read the details, lock your slot, and get ready to play.</p>
            </div>
            <div className="event-cards">
              <article className="event-card feature-card">
                <div className="card-top"><span className="card-icon"><Gamepad2 size={20} /></span><span className="card-number">01 / GAME</span></div>
                <h3>Your game.<br />Your arena.</h3><p>The organiser chooses the game and competition rules for each tournament.</p>
                <div className="game-tags"><span>Mobile</span><span>PC</span><span>Console</span></div>
              </article>
              <article className="event-card">
                <div className="card-top"><span className="card-icon"><Users size={20} /></span><span className="card-number">02 / FORMAT</span></div>
                <h3>Solo or squad.</h3><p>Choose the format set by your organiser. Team entries can include a captain and teammates.</p>
                <div className="card-footer"><span>Flexible team size</span><ArrowUpRightIcon /></div>
              </article>
              <article className="event-card">
                <div className="card-top"><span className="card-icon"><WalletCards size={20} /></span><span className="card-number">03 / ENTRY</span></div>
                <h3>Clear entry<br />details.</h3><p>Entry is free in this starter template. Your organiser shares the tournament details before you register.</p>
                <div className="card-footer"><span>Free entry · no payment required</span><ShieldCheck size={15} /></div>
              </article>
            </div>
          </section>

          <section className="section steps-section" id="rules">
            <div className="steps-copy"><div className="section-kicker">HOW TO ENTER</div><h2>THREE STEPS.<br /><span className="gradient-text">ONE SHOT.</span></h2><p>Simple from the first click to your registration confirmation.</p></div>
            <div className="steps-list">
              <div className="step-row"><span className="step-no">01</span><div><h3>Fill in your details</h3><p>Player name, contact details, game ID and team information.</p></div><Check size={18} /></div>
              <div className="step-row"><span className="step-no">02</span><div><h3>Review tournament details</h3><p>Check the organiser's schedule and rules before joining.</p></div><Check size={18} /></div>
              <div className="step-row"><span className="step-no">03</span><div><h3>Submit and track</h3><p>Keep your confirmation reference and check your status later.</p></div><ArrowRight size={18} /></div>
            </div>
          </section>

          <section className="register-wrap" id="registration">
            <div className="register-intro"><div className="section-kicker">YOUR MOMENT IS NOW</div><h2>CLAIM YOUR<br /><span className="gradient-text">SPOT.</span></h2><p>{isLiveEventRoute ? "Enter your details to register for this tournament." : "Enter your details below. This is a preview of the registration flow for the eSports template."}</p><div className="register-note"><ShieldCheck size={18} /><span>Your information should only be visible to the event organiser once the live platform is connected.</span></div></div>
            <div className="register-panel">
              <div className="panel-header"><div><span className="panel-label">PLAYER REGISTRATION</span><h3>{eventName}</h3></div><span className="open-badge"><span /> OPEN</span></div>
              {submitted ? (
                <div className="success-state"><div className="success-icon"><Check size={26} /></div><h3>YOU'RE ON THE LIST.</h3><p>{liveConfirmation?.message || "Preview submission received in this browser session. No data has been sent to a server."}</p><div className="confirmation-code"><span>{liveConfirmation ? "CONFIRMATION REFERENCE" : "DEMO CONFIRMATION"}</span><strong>{liveConfirmation?.confirmation_reference || "ARENA-DEMO-001"}</strong></div><button className="button button-primary full-width" onClick={() => { setSubmitted(false); setLiveConfirmation(null); setPlayerName(""); setPlayerEmail(""); setGameId(""); setTeamName(""); setPaymentScreenshot(null); }}>Register another player <ArrowRight size={16} /></button></div>
              ) : (
                <form className="registration-form" onSubmit={submitDemo}>
                  <div className="form-grid"><label>PLAYER NAME<input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Your in-game name" required /></label><label>EMAIL ADDRESS<input type="email" value={playerEmail} onChange={e => setPlayerEmail(e.target.value)} placeholder="you@example.com" required /></label><label>GAME ID / UID<input value={gameId} onChange={e => setGameId(e.target.value)} placeholder="Enter your player ID" required /></label><label>TEAM NAME <span className="optional">(optional)</span><input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Your squad name" /></label></div>
                  <div className="payment-box"><div className="payment-title"><ShieldCheck size={17} /><span>ENTRY POLICY</span><strong>{eventData?.entry_fee_minor > 0 ? "₹" + (eventData.entry_fee_minor / 100).toFixed(0) : "FREE"}</strong></div>{eventData?.entry_fee_minor > 0 ? <><p>{eventData.payment_instructions || "Follow the organiser's payment instructions, then attach your screenshot for review."}</p>{eventData.payment_qr_public_url ? <img className="payment-qr" src={eventData.payment_qr_public_url} alt="Organiser payment QR code" /> : null}<label className="upload-area"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPaymentScreenshot(e.target.files?.[0] || null)} required /><ImagePlus size={21} /><span><strong>{paymentScreenshot ? paymentScreenshot.name : "Attach payment screenshot"}</strong><small>PNG, JPG or WEBP · maximum 3 MB</small></span><span className="upload-action">{paymentScreenshot ? "Change" : "Browse"}</span></label></> : <p>This event is free to enter. No payment is collected.</p>}</div>
                  {submissionError ? <p className="form-error" role="alert">{submissionError}</p> : null}
                  <label className="consent-check"><input type="checkbox" required /><span>I confirm these details are accurate and agree to the event rules and privacy notice.</span></label>
                  <button className="button button-primary full-width" type="submit" disabled={isSubmitting || (isLiveEventRoute && !eventData)}>{isSubmitting ? "Submitting…" : isLiveEventRoute ? "Submit registration" : "Submit preview registration"} <ArrowRight size={17} /></button>
                  <p className="form-disclaimer"><ShieldCheck size={13} /> {isLiveEventRoute ? "Your registration is sent securely. Payment screenshots are private and must be verified by the organiser." : "Preview only. No payment is collected and no file is uploaded."}</p>
                </form>
              )}
            </div>
          </section>

          <footer className="footer"><button className="brand footer-brand" onClick={() => setView("site")}><span className="brand-mark"><Swords size={17} /></span><span className="brand-word">ARENA<span className="brand-period">.</span><small>POWERED BY COMPANY-001</small></span></button><span>Template 001 · eSports Tournament</span><button className="footer-link" onClick={() => setView("organizer")}>Organiser workspace <ArrowRight size={14} /></button></footer>
        </main>
      ) : (
        <main className="dashboard">
          <aside className="sidebar">
            <div className="workspace-label">WORKSPACE <ChevronDown size={14} /></div>
            <div className="workspace-card"><div className="workspace-avatar">N</div><div><strong>{organizerName}</strong><small>Template 001 · eSports</small></div><span className="demo-pill">DEMO</span></div>
            <div className="sidebar-section">MANAGE</div>
            <button className={view === "organizer" ? "side-link selected" : "side-link"} onClick={() => setView("organizer")}><LayoutDashboard size={17} /> Overview</button>
            <button className={view === "registrations" ? "side-link selected" : "side-link"} onClick={() => setView("registrations")}><Users size={17} /> Registrations <span className="side-count">12</span></button>
            <button className={view === "customize" ? "side-link selected" : "side-link"} onClick={() => setView("customize")}><Settings2 size={17} /> Customize template</button>
            <button className="side-link" onClick={() => setView("site")}><Globe2 size={17} /> Public event page <ExternalLink size={13} /></button>
            <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18} /><strong>Need more?</strong><p>Ask Company-001 for custom features beyond this template.</p><button onClick={() => alert("Consultation booking will be connected in a later phase.")}>Request help <ArrowRight size={14} /></button></div><div className="side-foot">COMPANY-001 · ORGANISER</div></div>
          </aside>
          <section className="dashboard-main">
            <div className="dashboard-top"><div><div className="section-kicker">ORGANISER WORKSPACE / TEMPLATE 001</div><h1>{view === "customize" ? "Make it yours." : view === "registrations" ? "Your registrations." : "Good evening, Nexus."}</h1><p>{view === "customize" ? "Edit the basics of your public event page." : view === "registrations" ? "Review incoming player entries and payment evidence." : "Here's what's happening with your tournament."}</p></div><button className="button button-primary" onClick={() => setView("site")}>Preview event <ExternalLink size={15} /></button></div>
            {view === "customize" ? (
              <div className="customize-layout"><div className="settings-panel"><div className="panel-header simple"><div><span className="panel-label">EVENT DETAILS</span><h3>Basic information</h3></div><Sparkles size={19} /></div><label className="setting-label">TOURNAMENT NAME<input value={eventName} onChange={e => setEventName(e.target.value)} /></label><label className="setting-label">ORGANISER / BRAND NAME<input value={organizerName} onChange={e => setOrganizerName(e.target.value)} /></label><div className="setting-label">ENTRY TYPE<div className="fixed-setting">Free entry · no payment collected</div></div><div className="setting-label">ACCENT COLOUR<div className="color-options"><button className={accent === "violet" ? "color-swatch violet active-swatch" : "color-swatch violet"} onClick={() => setAccent("violet")} aria-label="Violet accent" /><button className={accent === "cyan" ? "color-swatch cyan active-swatch" : "color-swatch cyan"} onClick={() => setAccent("cyan")} aria-label="Cyan accent" /><button className={accent === "lime" ? "color-swatch lime active-swatch" : "color-swatch lime"} onClick={() => setAccent("lime")} aria-label="Lime accent" /></div></div><div className="save-note"><Check size={15} /> Changes update this preview instantly. Live saving is not connected.</div></div><div className="preview-panel"><div className="preview-top"><span>LIVE PREVIEW</span><span className="preview-dot" /></div><div className="mini-preview"><div className="mini-nav">ARENA. <span>TOURNAMENT</span></div><div className="mini-hero"><div className="section-kicker">REGISTRATION OPEN</div><h2>{eventName || "YOUR TOURNAMENT"}</h2><p>YOUR NEXT VICTORY STARTS HERE.</p><span className="mini-button">REGISTER NOW</span></div><div className="mini-stats"><span>ENTRY <b>Free</b></span><span>FORMAT <b>Solo / Squad</b></span></div></div></div></div>
            ) : view === "registrations" ? (
              <div className="registrations-panel"><div className="table-toolbar"><div><h3>Player entries</h3><p>Example records for layout preview</p></div><button className="button button-secondary" onClick={() => alert("CSV export will work after live data is connected.")}>Export CSV <ArrowRight size={14} /></button></div><div className="table-scroll"><table><thead><tr><th>PLAYER</th><th>TEAM</th><th>GAME ID</th><th>REGISTRATION STATUS</th><th>ACTION</th></tr></thead><tbody>{sampleRegistrations.map((r) => <tr key={r.gameId}><td><strong>{r.name}</strong><small>Submitted today</small></td><td>{r.team}</td><td>{r.gameId}</td><td><span className={`status-chip ${r.tone}`}><span />{r.status}</span></td><td><button className="text-action" onClick={() => alert("Registration review will be connected after authentication and backend integration.")}>Review <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div><div className="table-foot">Showing 3 sample entries <span>12 total · demo only</span></div></div>
            ) : (
              <>
                <div className="status-banner"><div className="status-symbol"><Clock3 size={19} /></div><div><strong>Your template is in preview mode</strong><p>Connect your account and get organiser approval before publishing a real registration page.</p></div><span className="status-tag">NOT PUBLISHED</span></div>
                <div className="stats-grid"><div className="stat-card"><span>TOTAL REGISTRATIONS <Users size={16} /></span><strong>12</strong><small><span className="stat-muted">Sample data</span></small></div><div className="stat-card"><span>PENDING ENTRIES <Users size={16} /></span><strong>4</strong><small>Need organiser review</small></div><div className="stat-card"><span>VERIFIED PLAYERS <ShieldCheck size={16} /></span><strong>8</strong><small>Sample data</small></div><div className="stat-card"><span>PAGE VISITS <Globe2 size={16} /></span><strong>248</strong><small>Illustrative only</small></div></div>
                <div className="dashboard-grid"><div className="registrations-panel"><div className="table-toolbar"><div><h3>Recent registrations</h3><p>Keep payment evidence private and review each entry.</p></div><button className="text-action" onClick={() => setView("registrations")}>View all <ArrowRight size={14} /></button></div><div className="recent-list">{sampleRegistrations.slice(0,2).map(r => <div className="recent-row" key={r.gameId}><div className="player-avatar">{r.name.slice(0,1)}</div><div className="player-meta"><strong>{r.name}</strong><small>{r.team} · {r.gameId}</small></div><span className={`status-chip ${r.tone}`}><span />{r.status}</span></div>)}</div></div><div className="quick-panel"><span className="panel-label">QUICK ACTION</span><h3>Make the event<br />feel like yours.</h3><p>Update your event title, brand name and accent colour before you publish.</p><button className="button button-secondary full-width" onClick={() => setView("customize")}>Customize template <ArrowRight size={15} /></button><button className="copy-link" onClick={copyDemoLink}><Copy size={15} /> {copied ? "Demo link copied" : "Copy sample event link"}</button></div></div>
                <div className="bottom-tip"><Sparkles size={17} /><div><strong>Need a feature that isn't here?</strong><p>Book a free 30-minute consultation. If you need custom development, you'll receive a quote to approve before work starts.</p></div><button onClick={() => alert("Free 30-minute consultation booking will be connected in a later phase.")}>Request consultation <ArrowRight size={14} /></button></div>
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}

createRoot(document.getElementById("root")).render(<App />);
