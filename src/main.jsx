import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createRoot } from "react-dom/client";
import {
  ArrowDownRight, ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Copy, Gamepad2, Globe2, ImagePlus, LayoutDashboard,
  Menu, ShieldCheck, Sparkles, Swords, Trophy, Users, WalletCards, X,
  Zap, Settings2, ExternalLink, Music2, GraduationCap, Palette, BookOpen, HeartHandshake
} from "lucide-react";
import "./styles.css";
import OwnerPanel from "./OwnerPanel.jsx";
import OrganizerWorkspace from "./OrganizerWorkspace.jsx";
import CompanyHome from "./CompanyHome.jsx";

const SUPABASE_URL = "https://zkzgkovwktljfuuuhivk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const sampleRegistrations = [
  { name: "ShadowByte", team: "NOVA", gameId: "SB-2048", status: "Pending review", tone: "pending" },
  { name: "KairoX", team: "Solo", gameId: "KX-1109", status: "Verified", tone: "approved" },
  { name: "NeonRift", team: "PHANTOM", gameId: "NR-8821", status: "Pending review", tone: "pending" }
];

function App() {
  const [view, setView] = useState("site");
  const [platformRole, setPlatformRole] = useState(null);
  const [signedInUser, setSignedInUser] = useState(null);
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
  const categoryKey = (eventData?.category || "esports").toLowerCase();
  const categoryPresentation = ({
    esports: { label:"eSports tournament", cta:"Register for tournament", participant:"PLAYER NAME", idLabel:"GAME ID / UID", namePlaceholder:"Your in-game name", heroLine:"YOUR NEXT", heroAccent:"VICTORY", ticker:"TOURNAMENT DETAILS" },
    garba: { label:"Garba / Navratri event", cta:"Register for Garba night", participant:"ATTENDEE NAME", idLabel:"PASS / SESSION (optional)", namePlaceholder:"Your full name", heroLine:"CELEBRATE", heroAccent:"TOGETHER", ticker:"EVENT DETAILS" },
    sports: { label:"Sports tournament", cta:"Register for tournament", participant:"PARTICIPANT NAME", idLabel:"PLAYER / TEAM ID (optional)", namePlaceholder:"Your full name", heroLine:"PLAY FOR", heroAccent:"THE WIN", ticker:"COMPETITION DETAILS" },
    workshop: { label:"Workshop / seminar", cta:"Reserve your seat", participant:"ATTENDEE NAME", idLabel:"SESSION / TRACK (optional)", namePlaceholder:"Your full name", heroLine:"LEARN", heroAccent:"SOMETHING NEW", ticker:"SESSION DETAILS" },
    coaching: { label:"Coaching / classes", cta:"Enquire about this batch", participant:"STUDENT NAME", idLabel:"COURSE / BATCH (optional)", namePlaceholder:"Student full name", heroLine:"YOUR NEXT", heroAccent:"STEP STARTS HERE", ticker:"BATCH DETAILS" },
    cultural: { label:"Cultural event", cta:"Join the event", participant:"PARTICIPANT NAME", idLabel:"PERFORMANCE / CATEGORY (optional)", namePlaceholder:"Your full name", heroLine:"MAKE IT", heroAccent:"MEMORABLE", ticker:"EVENT DETAILS" },
    community: { label:"Community meetup", cta:"Join the meetup", participant:"ATTENDEE NAME", idLabel:"GROUP / SESSION (optional)", namePlaceholder:"Your full name", heroLine:"MEET. SHARE.", heroAccent:"CONNECT.", ticker:"MEETUP DETAILS" },
  })[categoryKey] || { label:"Event registration", cta:"Register for event", participant:"PARTICIPANT NAME", idLabel:"REFERENCE / CATEGORY (optional)", namePlaceholder:"Your full name", heroLine:"YOUR NEXT", heroAccent:"CHAPTER STARTS HERE", ticker:"EVENT DETAILS" };
  const HeroCategoryIcon = ({esports:Gamepad2,garba:Music2,sports:Trophy,workshop:BookOpen,coaching:GraduationCap,cultural:Palette,community:HeartHandshake})[categoryKey] || Gamepad2;
  const registrationClosed = Boolean(isLiveEventRoute && eventData?.registration_closes_at && new Date(eventData.registration_closes_at).getTime() <= Date.now());
  const organizerSlug = isLiveEventRoute ? routeSlugs[0] : "";
  const eventSlug = isLiveEventRoute ? routeSlugs[1] : "";

  useEffect(() => { const refresh = async (user) => { setSignedInUser(user || null); if (!user) { setPlatformRole(null); return; } const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(); setPlatformRole(profile?.platform_role || "organizer"); }; supabase.auth.getSession().then(({ data }) => refresh(data.session?.user || null)); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => refresh(session?.user || null), 0); }); return () => listener.subscription.unsubscribe(); }, []);

  useEffect(() => {
    if (!isLiveEventRoute) return;
    const query = new URLSearchParams({
      select: "id,title,category,game_title,team_format,team_size,entry_fee_minor,prize_pool_label,description,rules,starts_at,registration_closes_at,payment_instructions,payment_qr_public_url,organizers!inner(slug,display_name,status)",
      slug: "eq." + eventSlug,
      "organizers.slug": "eq." + organizerSlug,
      status: "eq.published",
      "organizers.status": "eq.approved",
    });
    fetch(SUPABASE_URL + "/rest/v1/events?" + query.toString(), { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
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
      const response = await fetch(SUPABASE_URL + "/functions/v1/register-esports", {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
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

  const copyPlatformLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (signedInUser && ["organizer", "registrations", "customize"].includes(view)) return <OrganizerWorkspace user={signedInUser} initialView={view} onBack={() => setView("site")} />;

  return (
    <div className={`app accent-${accent}`}>
      <div className={isLiveEventRoute ? "prototype-banner" : "prototype-banner company-banner"}>
        <span className="prototype-dot" />
        <span><strong>{isLiveEventRoute ? "LIVE EVENT PAGE" : "COMPANY-001 DIGITAL STUDIO"}</strong> · {isLiveEventRoute ? "Registration submissions use the secured backend. Payment screenshots require organiser verification." : "Custom websites, digital experiences and event tools for growing ideas."}</span>
        <button className="banner-link" onClick={() => isLiveEventRoute ? setView("account") : document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}>
          {isLiveEventRoute ? "Organiser sign in" : "Explore services"} <ArrowRight size={14} />
        </button>
      </div>

      <header className={isLiveEventRoute ? "topbar" : "topbar company-topbar"}>
        <button className="brand" onClick={() => setView("site")} aria-label={isLiveEventRoute ? "Event home" : "Company-001 home"}>
          <span className="brand-mark">{isLiveEventRoute ? <Swords size={19} strokeWidth={2.5} /> : <Globe2 size={19} strokeWidth={2.2} />}</span>
          <span className="brand-word">{isLiveEventRoute ? <>ARENA<span className="brand-period">.</span><small>POWERED BY COMPANY-001</small></> : <>COMPANY<span className="brand-period">-001</span><small>WEB & DIGITAL STUDIO</small></>}</span>
        </button>
        <nav className={mobileMenu ? "nav-links nav-open" : "nav-links"}>
          {view === "site" ? <>
            {isLiveEventRoute ? <><a href="#overview" onClick={() => setMobileMenu(false)}>Event</a><a href="#format" onClick={() => setMobileMenu(false)}>Details</a><a href="#rules" onClick={() => setMobileMenu(false)}>How to join</a></> : <><a href="#services" onClick={() => setMobileMenu(false)}>Services</a><a href="#process" onClick={() => setMobileMenu(false)}>Process</a><a href="#event-platform" onClick={() => setMobileMenu(false)}>Event platform</a></>}
          </> : <>
            <button className="nav-text active" onClick={() => setView("organizer")}>Overview</button>
            <button className="nav-text" onClick={() => setView("customize")}>Customize</button>
            <button className="nav-text" onClick={() => setView("registrations")}>Registrations</button>
          </>}
        </nav>
        <div className="top-actions">
          {platformRole === "owner" ? <button className="owner-shortcut" onClick={() => setView("owner")}><ShieldCheck size={14} /> OWNER</button> : null}
          <button className="account-entry" onClick={() => setView("account")} aria-label="Sign in or create organiser account">{signedInUser ? "WORKSPACE" : "SIGN IN"} <ArrowRight size={14} /></button>
          <button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      {view === "account" ? <AccountPanel onBack={() => setView("site")} /> : view === "owner" ? <OwnerPanel onBack={() => setView("site")} /> : view === "site" ? (
        isLiveEventRoute ? <main>
          <section className="hero" id="overview">
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="eyebrow"><span className="live-pip" /> REGISTRATION OPEN <span className="eyebrow-line" /> SEASON 01</div>
              <h1>{isLiveEventRoute ? <>{categoryPresentation.heroLine}<br /><span className="gradient-text">{categoryPresentation.heroAccent}</span></> : <>YOUR NEXT<br /><span className="gradient-text">VICTORY</span> STARTS HERE.</>}</h1>
              <p className="hero-copy">{eventData?.description || (isLiveEventRoute ? "Review the event details and organiser instructions, then register your interest." : "One arena. One shot at glory. Join the open tournament built for the next generation of competitors.")}</p>
              <div className="hero-buttons">
                <button className="button button-primary" onClick={openRegister}>{isLiveEventRoute ? categoryPresentation.cta : "Register for tournament"} <ArrowRight size={17} /></button>
                <a className="button button-quiet" href="#format">Explore event <ArrowDownRight size={17} /></a>
              </div>
              <div className="hero-trust"><span><ShieldCheck size={15} /> Organiser-managed event</span><span><Zap size={15} /> Fast registration</span></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-ring ring-three" />
              <div className="art-cross cross-one" /><div className="art-cross cross-two" />
              <div className="art-core"><HeroCategoryIcon size={96} strokeWidth={1.1} /></div>
              <div className="art-label label-top"><span className="label-dot" /> {isLiveEventRoute ? categoryPresentation.label.toUpperCase() : "OPEN QUALIFIERS"}</div>
              <div className="art-label label-bottom">{isLiveEventRoute ? <HeroCategoryIcon size={16} /> : <Trophy size={16} />} {isLiveEventRoute ? "REGISTRATION OPEN" : "COMPETE FOR THE CROWN"}</div>
              <div className="art-coordinate">22°43' N<br />75°51' E</div>
            </div>
            <div className="hero-index"><span>01</span> / 04</div>
          </section>

          <section className="ticker" aria-label={isLiveEventRoute ? "Event highlights" : "Tournament highlights"}>
            <div><Trophy size={17} /><span>REWARDS</span><strong>Badges & recognition</strong></div>
            <i />
            <div><Users size={17} /><span>FORMAT</span><strong>{isLiveEventRoute ? categoryPresentation.label : "Solo, teams & more"}</strong></div>
            <i />
            <div><CalendarDays size={17} /><span>REGISTRATION CLOSES</span><strong>{isLiveEventRoute && eventData?.registration_closes_at ? new Date(eventData.registration_closes_at).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "Check event details"}</strong></div>
            <i />
            <div>{isLiveEventRoute ? <HeroCategoryIcon size={17} /> : <Gamepad2 size={17} />}<span>EVENT TYPE</span><strong>{isLiveEventRoute ? categoryPresentation.label : "Choose your format"}</strong></div>
          </section>

          {!isLiveEventRoute ? <section className="section template-showcase" id="templates">
            <div className="section-heading">
              <div><div className="section-kicker">ONE PLATFORM · MANY POSSIBILITIES</div><h2>YOUR EVENT.<br /><span className="gradient-text">YOUR FORMAT.</span></h2></div>
              <p>Company-001 is built for more than gaming. Start from a ready-made event layout and tailor it to your audience.</p>
            </div>
            <div className="showcase-grid">
              <article className="showcase-card showcase-esports"><span className="showcase-icon"><Gamepad2 size={21}/></span><span className="showcase-tag">01 · COMPETITION</span><h3>eSports tournaments</h3><p>Player sign-ups, game IDs, squads, entry information and competition rules.</p><small>Example · Nexus Open Qualifiers</small></article>
              <article className="showcase-card showcase-garba"><span className="showcase-icon"><Music2 size={21}/></span><span className="showcase-tag">02 · CULTURE</span><h3>Garba & Navratri</h3><p>Pass registrations, evening sessions, venue details and attendee instructions.</p><small>Example · Rang Raas Garba Night</small></article>
              <article className="showcase-card showcase-sports"><span className="showcase-icon"><Trophy size={21}/></span><span className="showcase-tag">03 · SPORTS</span><h3>Sports tournaments</h3><p>Team entries, player categories, schedules, venue and match rules.</p><small>Example · City Champions Cup</small></article>
              <article className="showcase-card showcase-workshop"><span className="showcase-icon"><BookOpen size={21}/></span><span className="showcase-tag">04 · LEARNING</span><h3>Workshops & seminars</h3><p>Reserve seats, share the agenda, and collect attendee contact details.</p><small>Example · Creative Skills Lab</small></article>
              <article className="showcase-card showcase-coaching"><span className="showcase-icon"><GraduationCap size={21}/></span><span className="showcase-tag">05 · EDUCATION</span><h3>Coaching & classes</h3><p>Course enquiries, batch selection, session timings and enrolment details.</p><small>Example · Foundation Learning Batch</small></article>
              <article className="showcase-card showcase-community"><span className="showcase-icon"><HeartHandshake size={21}/></span><span className="showcase-tag">06 · COMMUNITY</span><h3>Cultural & community events</h3><p>Showcases, meetups, auditions, volunteer groups and local gatherings.</p><small>Example · Rhythm & Culture Fest</small></article>
            </div>
            <div className="showcase-cta"><div><strong>Have an event idea?</strong><span>Start with a template and customise the details for your audience.</span></div><button className="button button-primary" onClick={() => setView(signedInUser ? "organizer" : "account")}>Explore organiser workspace <ArrowRight size={15}/></button></div>
          </section> : null}

          <section className="section event-section" id="format">
            <div className="section-heading">
              <div><div className="section-kicker">{isLiveEventRoute ? categoryPresentation.ticker : "THE MISSION"}</div><h2>{isLiveEventRoute ? <>MADE FOR <span className="gradient-text">{categoryPresentation.label.toUpperCase()}.</span></> : <>BUILT FOR THE <span className="gradient-text">COMPETITIVE.</span></>}</h2></div>
              <p>{isLiveEventRoute ? "Review the organiser’s details, schedule, entry requirements and rules before registering." : "Everything you need to know before you drop in. Read the details, lock your slot, and get ready to play."}</p>
            </div>
            <div className="event-cards">
              <article className="event-card feature-card">
                <div className="card-top"><span className="card-icon"><Gamepad2 size={20} /></span><span className="card-number">01 / {isLiveEventRoute ? "EVENT" : "GAME"}</span></div>
                <h3>{isLiveEventRoute ? "Your event." : "Your game."}<br />{isLiveEventRoute ? "Your way." : "Your arena."}</h3><p>{isLiveEventRoute ? "Review the organiser’s event details, schedule and instructions before registering." : "The organiser chooses the game and competition rules for each tournament."}</p>
                <div className="game-tags">{isLiveEventRoute ? <><span>{categoryPresentation.label}</span><span>{eventData?.game_title || "All welcome"}</span></> : <><span>Mobile</span><span>PC</span><span>Console</span></>}</div>
              </article>
              <article className="event-card">
                <div className="card-top"><span className="card-icon"><Users size={20} /></span><span className="card-number">02 / FORMAT</span></div>
                <h3>{isLiveEventRoute ? "Clear details." : "Solo or squad."}</h3><p>{isLiveEventRoute ? "Check the event format, timing, location and organiser instructions before you join." : "Choose the format set by your organiser. Team entries can include a captain and teammates."}</p>
                <div className="card-footer"><span>{isLiveEventRoute ? `Group size: ${eventData?.team_size || 1}` : "Flexible team size"}</span><ArrowUpRightIcon /></div>
              </article>
              <article className="event-card">
                <div className="card-top"><span className="card-icon"><WalletCards size={20} /></span><span className="card-number">03 / ENTRY</span></div>
                <h3>Clear entry<br />details.</h3><p>{isLiveEventRoute ? "The organiser sets the entry requirements and payment instructions for this event." : "Entry is free in this starter template. Your organiser shares the tournament details before you register."}</p>
                <div className="card-footer"><span>{isLiveEventRoute && eventData?.entry_fee_minor > 0 ? `Entry fee · ₹${(eventData.entry_fee_minor / 100).toFixed(0)}` : "Free entry · no payment required"}</span><ShieldCheck size={15} /></div>
              </article>
            </div>
          </section>

          <section className="section steps-section" id="rules">
            <div className="steps-copy"><div className="section-kicker">{isLiveEventRoute ? "HOW TO REGISTER" : "HOW TO ENTER"}</div><h2>{isLiveEventRoute ? <>THREE STEPS.<br /><span className="gradient-text">ONE EVENT.</span></> : <>THREE STEPS.<br /><span className="gradient-text">ONE SHOT.</span></>}</h2><p>Simple from the first click to your registration confirmation.</p></div>
            <div className="steps-list">
              <div className="step-row"><span className="step-no">01</span><div><h3>Fill in your details</h3><p>{isLiveEventRoute ? "Enter your name and contact details, plus any event-specific information requested." : "Player name, contact details, game ID and team information."}</p></div><Check size={18} /></div>
              <div className="step-row"><span className="step-no">02</span><div><h3>{isLiveEventRoute ? "Review event details" : "Review tournament details"}</h3><p>Check the organiser’s schedule, entry requirements and rules before joining.</p></div><Check size={18} /></div>
              <div className="step-row"><span className="step-no">03</span><div><h3>Submit and track</h3><p>Keep your confirmation reference and check your status later.</p></div><ArrowRight size={18} /></div>
            </div>
          </section>

          <section className="register-wrap" id="registration">
            <div className="register-intro"><div className="section-kicker">YOUR MOMENT IS NOW</div><h2>{isLiveEventRoute ? "SAVE YOUR" : "CLAIM YOUR"}<br /><span className="gradient-text">{isLiveEventRoute ? "PLACE." : "SPOT."}</span></h2><p>{isLiveEventRoute ? "Enter your details to " + categoryPresentation.cta.toLowerCase() + "." : "Enter your details below to preview the registration flow. No live registration is created from this homepage."}</p><div className="register-note"><ShieldCheck size={18} /><span>{isLiveEventRoute ? "Your details are sent to the organiser. Payment screenshots stay private while awaiting review." : "Live registrations are available on published event pages; this homepage form is preview-only."}</span></div></div>
            <div className="register-panel">
              <div className="panel-header"><div><span className="panel-label">{isLiveEventRoute ? "EVENT REGISTRATION" : "PLAYER REGISTRATION"}</span><h3>{eventName}</h3></div><span className={"open-badge" + (registrationClosed ? " closed" : "")}><span /> {registrationClosed ? "CLOSED" : "OPEN"}</span></div>
              {submitted ? (
                <div className="success-state"><div className="success-icon"><Check size={26} /></div><h3>YOU'RE ON THE LIST.</h3><p>{liveConfirmation?.message || "Preview submission received in this browser session. No data has been sent to a server."}</p><div className="confirmation-code"><span>{liveConfirmation ? "CONFIRMATION REFERENCE" : "DEMO CONFIRMATION"}</span><strong>{liveConfirmation?.confirmation_reference || "ARENA-DEMO-001"}</strong></div><button className="button button-primary full-width" onClick={() => { setSubmitted(false); setLiveConfirmation(null); setPlayerName(""); setPlayerEmail(""); setGameId(""); setTeamName(""); setPaymentScreenshot(null); }}>{isLiveEventRoute && categoryKey !== "esports" ? "Register another attendee" : "Register another player"} <ArrowRight size={16} /></button></div>
              ) : (
                <form className="registration-form" onSubmit={submitDemo}>
                  <div className="form-grid"><label>{isLiveEventRoute ? categoryPresentation.participant : "PLAYER NAME"}<input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder={isLiveEventRoute ? categoryPresentation.namePlaceholder : "Your in-game name"} required /></label><label>EMAIL ADDRESS<input type="email" value={playerEmail} onChange={e => setPlayerEmail(e.target.value)} placeholder="you@example.com" required /></label><label>{isLiveEventRoute ? categoryPresentation.idLabel : "GAME ID / UID"}<input value={gameId} onChange={e => setGameId(e.target.value)} placeholder={isLiveEventRoute && categoryKey !== "esports" ? "Optional details" : "Enter your player ID"} required={!isLiveEventRoute || categoryKey === "esports"} /></label><label>TEAM NAME <span className="optional">(optional)</span><input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Your squad name" /></label></div>
                  <div className="payment-box"><div className="payment-title"><ShieldCheck size={17} /><span>ENTRY POLICY</span><strong>{eventData?.entry_fee_minor > 0 ? "₹" + (eventData.entry_fee_minor / 100).toFixed(0) : "FREE"}</strong></div>{eventData?.entry_fee_minor > 0 ? <><p>{eventData.payment_instructions || "Follow the organiser's payment instructions, then attach your screenshot for review."}</p>{eventData.payment_qr_public_url ? <img className="payment-qr" src={eventData.payment_qr_public_url} alt="Organiser payment QR code" /> : null}<label className="upload-area"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPaymentScreenshot(e.target.files?.[0] || null)} required /><ImagePlus size={21} /><span><strong>{paymentScreenshot ? paymentScreenshot.name : "Attach payment screenshot"}</strong><small>PNG, JPG or WEBP · maximum 3 MB</small></span><span className="upload-action">{paymentScreenshot ? "Change" : "Browse"}</span></label></> : <p>This event is free to enter. No payment is collected.</p>}</div>
                  {submissionError ? <p className="form-error" role="alert">{submissionError}</p> : null}
                  <label className="consent-check"><input type="checkbox" required /><span>I confirm these details are accurate and agree to the event rules and privacy notice.</span></label>
                  <button className="button button-primary full-width" type="submit" disabled={isSubmitting || (isLiveEventRoute && (!eventData || registrationClosed))}>{isSubmitting ? "Submitting…" : registrationClosed ? "Registration closed" : isLiveEventRoute ? "Submit registration" : "Submit preview registration"} <ArrowRight size={17} /></button>
                  <p className="form-disclaimer"><ShieldCheck size={13} /> {isLiveEventRoute ? "Your registration is sent securely. Payment screenshots are private and must be verified by the organiser." : "Preview only. No payment is collected and no file is uploaded."}</p>
                </form>
              )}
            </div>
          </section>

          <footer className="footer"><button className="brand footer-brand" onClick={() => setView("site")}><span className="brand-mark"><Swords size={17} /></span><span className="brand-word">ARENA<span className="brand-period">.</span><small>POWERED BY COMPANY-001</small></span></button><span>{isLiveEventRoute ? categoryPresentation.label : "Company-001 · Event templates"}</span><button className="footer-link" onClick={() => setView(signedInUser ? "organizer" : "account")}>Organiser workspace <ArrowRight size={14} /></button></footer>
        </main> : <CompanyHome onStart={() => document.getElementById("process")?.scrollIntoView({ behavior: "smooth" })} onOrganiser={() => setView(signedInUser ? "organizer" : "account")} />
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
                <div className="dashboard-grid"><div className="registrations-panel"><div className="table-toolbar"><div><h3>Recent registrations</h3><p>Keep payment evidence private and review each entry.</p></div><button className="text-action" onClick={() => setView("registrations")}>View all <ArrowRight size={14} /></button></div><div className="recent-list">{sampleRegistrations.slice(0,2).map(r => <div className="recent-row" key={r.gameId}><div className="player-avatar">{r.name.slice(0,1)}</div><div className="player-meta"><strong>{r.name}</strong><small>{r.team} · {r.gameId}</small></div><span className={`status-chip ${r.tone}`}><span />{r.status}</span></div>)}</div></div><div className="quick-panel"><span className="panel-label">QUICK ACTION</span><h3>Make the event<br />feel like yours.</h3><p>Update your event title, brand name and accent colour before you publish.</p><button className="button button-secondary full-width" onClick={() => setView("customize")}>Customize template <ArrowRight size={15} /></button><button className="copy-link" onClick={copyPlatformLink}><Copy size={15} /> {copied ? "Platform link copied" : "Copy platform link"}</button></div></div>
                <div className="bottom-tip"><Sparkles size={17} /><div><strong>Need a feature that isn't here?</strong><p>Book a free 30-minute consultation. If you need custom development, you'll receive a quote to approve before work starts.</p></div><button onClick={() => alert("Free 30-minute consultation booking will be connected in a later phase.")}>Request consultation <ArrowRight size={14} /></button></div>
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}


function AccountPanel({ onBack }) {
  const [mode, setMode] = useState("signup");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [organizerCategory, setOrganizerCategory] = useState("esports");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [application, setApplication] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setApplication(null); return; }
    supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "Organizer",
      platform_role: "organizer",
    }, { onConflict: "id", ignoreDuplicates: true }).then(({ error }) => {
      if (error) setNotice("Your account is signed in, but profile setup needs attention. Please contact support.");
    });
    supabase.from("organizer_applications").select("id,business_name,status,decision_note,created_at")
      .eq("applicant_user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data, error }) => { if (!error) setApplication(data); });
  }, [user]);

  const authenticate = async (event) => {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created. Check your email to confirm the account, then sign in here.");
        } else {
          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id, display_name: displayName.trim(), platform_role: "organizer",
          });
          if (profileError && profileError.code !== "23505") throw profileError;
          setUser(data.user);
          setNotice("Account created. Next, submit your organiser application.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id, display_name: data.user.user_metadata?.display_name || email.split("@")[0], platform_role: "organizer",
        }, { onConflict: "id", ignoreDuplicates: true });
        if (profileError) throw profileError;
        setUser(data.user);
        setNotice("Signed in successfully.");
      }
    } catch (error) {
      setNotice(error.message || "Could not complete account action.");
    } finally { setBusy(false); }
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await supabase.from("organizer_applications").insert({
        applicant_user_id: user.id,
        business_name: businessName.trim(),
        category: organizerCategory,
        contact_email: user.email,
        notes: "Requested event category: " + organizerCategory,
      }).select("id,business_name,status,decision_note,created_at").single();
      if (error) throw error;
      setApplication(data);
      setNotice("Application submitted. You can preview your template while we review it.");
    } catch (error) {
      setNotice(error.message || "Could not submit the organiser application.");
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setApplication(null); setNotice("Signed out.");
  };

  return (
    <main className="account-shell">
      <section className="account-card">
        <button className="account-back" onClick={onBack}><ArrowRight size={14} /> Back to event templates</button>
        <div className="section-kicker">COMPANY-001 / ORGANISER ACCESS</div>
        <h1>{user ? "Your organiser account." : mode === "signup" ? "Start your arena." : "Welcome back."}</h1>
        <p className="account-lead">Create an account, apply for organiser approval, and prepare registration pages for your kind of event.</p>
        {!user ? (
          <>
            <div className="account-tabs"><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setNotice(""); }}>Create account</button><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setNotice(""); }}>Sign in</button></div>
            <form className="account-form" onSubmit={authenticate}>
              {mode === "signup" ? <label>YOUR DISPLAY NAME<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={80} required placeholder="How organisers see your name" /></label> : null}
              <label>EMAIL ADDRESS<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
              <label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>
              <button className="button button-primary full-width" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signup" ? "Create organiser account" : "Sign in"} <ArrowRight size={16} /></button>
            </form>
          </>
        ) : (
          <div className="account-signed-in">
            <div className="account-user"><span>{(user.email || "O").slice(0,1).toUpperCase()}</span><div><strong>{user.user_metadata?.display_name || user.email}</strong><small>{user.email}</small></div><button onClick={signOut}>Sign out</button></div>
            {application ? (
              <div className="application-status"><span className="panel-label">ORGANISER APPLICATION</span><strong>{application.business_name}</strong><span className={"status-chip " + (application.status === "approved" ? "approved" : application.status === "rejected" ? "pending" : "pending")}><span />{application.status.replace("_"," ").toUpperCase()}</span><p>{application.status === "approved" ? "Your application is approved. The owner workspace still needs to activate your organiser page." : application.status === "rejected" ? (application.decision_note || "Please contact support for the next steps.") : "Your application is waiting for owner review."}</p></div>
            ) : (
              <form className="account-form" onSubmit={submitApplication}>
                <label>ORGANISER / COMMUNITY NAME<input value={businessName} onChange={e => setBusinessName(e.target.value)} required minLength={2} maxLength={120} placeholder="Your event or community name" /></label>
                <label>WHAT KIND OF EVENTS DO YOU RUN?<select value={organizerCategory} onChange={e => setOrganizerCategory(e.target.value)} required><option value="esports">eSports tournaments</option><option value="garba">Garba / Navratri</option><option value="sports">Sports tournaments</option><option value="workshop">Workshops / seminars</option><option value="coaching">Coaching / classes</option><option value="cultural">Cultural events</option><option value="community">Community meetups</option></select></label>
                <div className="account-template-note"><Globe2 size={17} /><span><strong>Multi-category organiser access</strong><small>Choose your main category. You can create event drafts from the available templates after approval.</small></span></div>
                <button className="button button-primary full-width" disabled={busy} type="submit">{busy ? "Submitting…" : "Apply for organiser approval"} <ArrowRight size={16} /></button>
              </form>
            )}
          </div>
        )}
        {notice ? <p className="account-notice" role="status">{notice}</p> : null}
        <p className="account-footnote">Never share your password or payment credentials. Approval is required before a live event can be published.</p>
      </section>
    </main>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}

createRoot(document.getElementById("root")).render(<App />);
