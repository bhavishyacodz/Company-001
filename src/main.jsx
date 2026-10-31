import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownRight, ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Copy, Gamepad2, Globe2, ImagePlus, LayoutDashboard, MapPin, Mail, PhoneCall,
  Menu, RefreshCw, ShieldCheck, Sparkles, Swords, Trophy, Users, WalletCards, X, LogOut, Settings,
  Zap, Settings2, ExternalLink, Music2, GraduationCap, Palette, BookOpen, HeartHandshake, KeyRound
} from "lucide-react";
import "./styles.css";
import "./premium-refresh.css";
import "./experience-redesign.css";
import OwnerPanel from "./OwnerPanel.jsx";
import OrganizerWorkspace from "./OrganizerWorkspace.jsx";
import CompanyHome from "./CompanyHome.jsx";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./services/supabase/client.js";

const sampleRegistrations = [
  { name: "ShadowByte", team: "NOVA", gameId: "SB-2048", status: "Pending review", tone: "pending" },
  { name: "KairoX", team: "Solo", gameId: "KX-1109", status: "Verified", tone: "approved" },
  { name: "NeonRift", team: "PHANTOM", gameId: "NR-8821", status: "Pending review", tone: "pending" }
];

const getSafeHttpsImageUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password ? parsed.href : "";
  } catch { return ""; }
};

function App() {
  const [view, setView] = useState(() => { try { const saved = window.sessionStorage.getItem("company001:last-view"); return saved === "profile" ? "account" : ["organizer","registrations","customize"].includes(saved) ? saved : "site"; } catch { return "site"; } });
  const [requestedTemplate, setRequestedTemplate] = useState(() => { try { return window.localStorage.getItem("company001:selected-template") || "esports-001"; } catch { return "esports-001"; } });
  const [platformRole, setPlatformRole] = useState(null);
  const [organizerWorkspaceReady, setOrganizerWorkspaceReady] = useState(false);
  const [organizerWorkspaceSummary, setOrganizerWorkspaceSummary] = useState(null);
  const [signedInUser, setSignedInUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authResolving, setAuthResolving] = useState(false);
  const authResolutionRef = useRef(0);
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

  useEffect(() => { try { if (view === "account" && signedInUser) window.sessionStorage.setItem("company001:last-view", "profile"); else if (["organizer","registrations","customize"].includes(view)) window.sessionStorage.setItem("company001:last-view", view); else window.sessionStorage.removeItem("company001:last-view"); } catch { /* Route restoration is optional. */ } }, [view, signedInUser]);

  useEffect(() => {
    let active = true;
    let resolvedUserId = null;
    let roleResolvedUserId = null;
    let lastScheduledUserId;
    const protectedViews = ["organizer", "registrations", "customize"];

    const resolveSession = async (user) => {
      const version = ++authResolutionRef.current;
      if (!active) return;
      if (!user) {
        resolvedUserId = null;
        roleResolvedUserId = null;
        setAuthResolving(false);
        setSignedInUser(null);
        setPlatformRole(null);
        setOrganizerWorkspaceReady(false);
        setOrganizerWorkspaceSummary(null);
        setView(current => protectedViews.includes(current) ? "site" : current);
        return;
      }
      if (roleResolvedUserId === user.id) {
        setSignedInUser(user);
        return;
      }

      const changedUser = resolvedUserId !== user.id;
      resolvedUserId = user.id;
      setSignedInUser(user);
      if (changedUser) {
        setAuthResolving(true);
        setPlatformRole(null);
        setOrganizerWorkspaceReady(false);
        setOrganizerWorkspaceSummary(null);
      }

      try {
        const [profileResult, organizerResult] = await Promise.all([
          supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(),
          supabase.from("organizers").select("id,display_name,slug,status").eq("owner_user_id", user.id).maybeSingle(),
        ]);
        if (!active || version !== authResolutionRef.current) return;

        const { data: profile, error: profileError } = profileResult;
        const { data: organizer, error: organizerError } = organizerResult;
        const role = !profileError && profile && ["owner", "organizer"].includes(profile.platform_role)
          ? profile.platform_role
          : "unknown";
        setPlatformRole(role);

        const organizerGoogleCallback = new URLSearchParams(window.location.search).get("auth_flow") === "organizer_google";
        if (organizerGoogleCallback) {
          window.history.replaceState({}, document.title, window.location.pathname);
          const pendingDeleteReauthUser = window.sessionStorage.getItem("company001:delete-reauth");
          const pendingPasswordReauthUser = window.sessionStorage.getItem("company001:password-reauth");
          const returningFromDeleteReauth = pendingDeleteReauthUser === user.id;
          const returningFromPasswordReauth = pendingPasswordReauthUser === user.id;
          if (pendingDeleteReauthUser && !returningFromDeleteReauth) window.sessionStorage.removeItem("company001:delete-reauth");
          if (pendingPasswordReauthUser && !returningFromPasswordReauth) window.sessionStorage.removeItem("company001:password-reauth");
          if (role === "owner") {
            try { window.sessionStorage.setItem("company001:google-owner-blocked", "1"); } catch { /* Notice is optional. */ }
            await supabase.auth.signOut();
            if (active && version === authResolutionRef.current) {
              resolvedUserId = null;
              roleResolvedUserId = null;
              setSignedInUser(null);
              setPlatformRole(null);
              setOrganizerWorkspaceReady(false);
              setOrganizerWorkspaceSummary(null);
              setView("account");
              setAuthResolving(false);
            }
            return;
          }
          if ((returningFromDeleteReauth || returningFromPasswordReauth) && role === "organizer") {
            setOrganizerWorkspaceSummary(organizer || null);
            setOrganizerWorkspaceReady(Boolean(organizer && !organizerError));
            roleResolvedUserId = user.id;
            setView("account");
            setAuthResolving(false);
            return;
          }
        }

        if (isLiveEventRoute) {
          roleResolvedUserId = user.id;
          setAuthResolving(false);
          return;
        }
        if (role === "owner") {
          setOrganizerWorkspaceReady(false);
          setOrganizerWorkspaceSummary(null);
          const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!active || version !== authResolutionRef.current) return;
          setView(!assuranceError && assurance?.currentLevel === "aal2" ? "owner" : "king-login");
          roleResolvedUserId = user.id;
          setAuthResolving(false);
          return;
        }
        if (role !== "organizer") {
          setOrganizerWorkspaceReady(false);
          setOrganizerWorkspaceSummary(null);
          setView("account");
          roleResolvedUserId = user.id;
          setAuthResolving(false);
          return;
        }
        if (organizerError) {
          setPlatformRole("unknown");
          setOrganizerWorkspaceReady(false);
          setOrganizerWorkspaceSummary(null);
          setView("account");
          roleResolvedUserId = user.id;
          setAuthResolving(false);
          return;
        }
        if (!organizer) {
          setOrganizerWorkspaceReady(false);
          setOrganizerWorkspaceSummary(null);
          setView("account");
          roleResolvedUserId = user.id;
          setAuthResolving(false);
          return;
        }

        setOrganizerWorkspaceSummary(organizer);
        setOrganizerWorkspaceReady(true);
        if (window.sessionStorage.getItem("company001:password-update-reauth") === user.id) {
          window.sessionStorage.removeItem("company001:password-update-reauth");
          setView("account");
          roleResolvedUserId = user.id;
          setAuthResolving(false);
          return;
        }
        const savedView = window.sessionStorage.getItem("company001:last-view");
        setView(organizerGoogleCallback ? "account" : savedView === "profile" ? "account" : protectedViews.includes(savedView) ? savedView : "account");
        roleResolvedUserId = user.id;
        setAuthResolving(false);
      } catch {
        if (!active || version !== authResolutionRef.current) return;
        setPlatformRole("unknown");
        setOrganizerWorkspaceReady(false);
        setOrganizerWorkspaceSummary(null);
        setView(isLiveEventRoute ? "site" : "account");
        roleResolvedUserId = user.id;
        setAuthResolving(false);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"].includes(event)) return;
      const nextUserId = session?.user?.id || null;
      if (event === "SIGNED_IN" && nextUserId === lastScheduledUserId) return;
      if (event === "SIGNED_OUT") lastScheduledUserId = null;
      else lastScheduledUserId = nextUserId;

      window.setTimeout(() => {
        if (!active) return;
        if (nextUserId && roleResolvedUserId === nextUserId) {
          setSignedInUser(session.user);
          if (event === "INITIAL_SESSION") setAuthReady(true);
          return;
        }
        void resolveSession(session?.user || null).finally(() => {
          if (active && event === "INITIAL_SESSION") setAuthReady(true);
        });
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isLiveEventRoute) return;
    const query = new URLSearchParams({
      select: "id,title,category,game_title,team_format,team_size,entry_fee_minor,prize_pool_label,description,rules,starts_at,registration_closes_at,payment_instructions,payment_qr_public_url,branding,organizers!inner(slug,display_name,status)",
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

  const openOrganizerWorkspace = async (candidateUser = signedInUser) => {
    if (!candidateUser?.id) {
      setOrganizerWorkspaceReady(false);
      setView("account");
      return;
    }
    // The app bootstrap has already verified this exact user and their organiser row.
    // Reuse that verified result instead of repeating profile/workspace requests.
    if (candidateUser.id === signedInUser?.id && platformRole === "organizer" && organizerWorkspaceSummary?.id) {
      setOrganizerWorkspaceReady(true);
      setView("organizer");
      return;
    }
    const version = ++authResolutionRef.current;
    setAuthResolving(true);
    setSignedInUser(candidateUser);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("platform_role").eq("id", candidateUser.id).maybeSingle();
      if (version !== authResolutionRef.current) return;
      if (profileError || profile?.platform_role !== "organizer") {
        setPlatformRole("unknown");
        setOrganizerWorkspaceReady(false);
        setView("account");
        return;
      }
      const { data: organizer, error: organizerError } = await supabase
        .from("organizers").select("id").eq("owner_user_id", candidateUser.id).maybeSingle();
      if (version !== authResolutionRef.current) return;
      if (organizerError || !organizer) {
        setPlatformRole("organizer");
        setOrganizerWorkspaceReady(false);
        setView("account");
        return;
      }
      setPlatformRole("organizer");
      setOrganizerWorkspaceReady(true);
      setView("organizer");
    } catch {
      if (version !== authResolutionRef.current) return;
      setPlatformRole("unknown");
      setOrganizerWorkspaceReady(false);
      setView("account");
    } finally {
      if (version === authResolutionRef.current) setAuthResolving(false);
    }
  };

  const handleUseTemplate = async (templateKey) => {
    setRequestedTemplate(templateKey);
    try { window.localStorage.setItem("company001:selected-template", templateKey); } catch { /* Template preference is optional. */ }
    if (platformRole === "owner") {
      // Owner access always passes through the dedicated MFA verification screen.
      setView("king-login");
      return;
    }
    if (!signedInUser || platformRole !== "organizer") {
      setView("account");
      return;
    }
    if (organizerWorkspaceSummary?.id) {
      setOrganizerWorkspaceReady(true);
      setView("customize");
      return;
    }
    const { data: organizer, error } = await supabase.from("organizers")
      .select("id").eq("owner_user_id", signedInUser.id).maybeSingle();
    const ready = !error && Boolean(organizer);
    if (ready) setOrganizerWorkspaceSummary(organizer);
    setOrganizerWorkspaceReady(ready);
    setView(ready ? "customize" : "account");
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

  if (!isLiveEventRoute && (!authReady || authResolving)) return <main className="workspace-shell"><section className="workspace-card workspace-auth-restoring" role="status" aria-live="polite"><div className="section-kicker">COMPANY-001 / SECURE ACCESS</div><h1>Restoring your profile…</h1><p>Checking your saved Google session and loading your workspace.</p></section></main>;
  if (["organizer", "registrations", "customize"].includes(view) && (!signedInUser || platformRole !== "organizer" || !organizerWorkspaceReady)) return <AccountPanel initialUser={platformRole === "organizer" ? signedInUser : null} initialOrganizer={organizerWorkspaceSummary} onBack={() => setView("site")} onOpenWorkspace={openOrganizerWorkspace} onOpenKingLogin={() => setView("king-login")} />;
  if (signedInUser && platformRole === "organizer" && organizerWorkspaceReady && ["organizer", "registrations", "customize"].includes(view)) return <OrganizerWorkspace user={signedInUser} initialView={view} initialTemplateKey={requestedTemplate} onBack={() => setView("site")} />;
  if (view === "owner" && platformRole !== "owner") return <KingLoginPanel onBack={() => setView("site")} onSuccess={() => setView("owner")} />;
  // Never fall through to the legacy demo dashboard when a saved workspace route has no valid session.

  return (
    <div className={`app accent-${accent}`} style={isLiveEventRoute ? { "--accent": eventData?.branding?.primaryColor || "#9a6bff", "--accent-2": eventData?.branding?.primaryColor || "#5be7e3", fontFamily: ["Inter","DM Sans","Space Grotesk","Poppins","Montserrat","Playfair Display"].includes(eventData?.branding?.fontFamily) ? eventData.branding.fontFamily : undefined, "--event-hero-title-size": `${Math.max(42,Math.min(104,Number(eventData?.branding?.heroTitleSize)||72))}px`, "--event-hero-title-align": ["left","center","right"].includes(eventData?.branding?.heroTitleAlign) ? eventData.branding.heroTitleAlign : "left", "--event-hero-title-color": /^#[0-9a-fA-F]{6}$/.test(eventData?.branding?.heroTitleColor||"") ? eventData.branding.heroTitleColor : "#ffffff", "--event-hero-title-x": `${Math.max(-160,Math.min(160,Number(eventData?.branding?.heroTitleX)||0))}px`, "--event-hero-title-y": `${Math.max(-100,Math.min(100,Number(eventData?.branding?.heroTitleY)||0))}px`, "--event-hero-copy-x": `${Math.max(-160,Math.min(160,Number(eventData?.branding?.descriptionX)||0))}px`, "--event-hero-copy-y": `${Math.max(-100,Math.min(100,Number(eventData?.branding?.descriptionY)||0))}px` } : undefined}>
      <div className={isLiveEventRoute ? "prototype-banner" : "prototype-banner company-banner"}>
        <span className="prototype-dot" />
        <span><strong>{isLiveEventRoute ? "LIVE EVENT PAGE" : "COMPANY-001 DIGITAL STUDIO"}</strong> · {isLiveEventRoute ? "Registration submissions use the secured backend. Payment screenshots require organiser verification." : "Custom websites, digital experiences and event tools for growing ideas."}</span>
        {!isLiveEventRoute && <button className="banner-link" onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}>
          Explore services <ArrowRight size={14} />
        </button>}
      </div>

      <header className={isLiveEventRoute ? "topbar" : "topbar company-topbar"}>
        <button className="brand" onClick={() => setView("site")} aria-label={isLiveEventRoute ? "Event home" : "Company-001 home"}>
          <span className="brand-mark">{isLiveEventRoute && eventData?.branding?.logoUrl ? <img className="event-brand-logo" src={eventData.branding.logoUrl} alt="" /> : isLiveEventRoute ? <Swords size={19} strokeWidth={2.5} /> : <Globe2 size={19} strokeWidth={2.2} />}</span>
          <span className="brand-word">{isLiveEventRoute ? <>ARENA<span className="brand-period">.</span><small>POWERED BY COMPANY-001</small></> : <>COMPANY<span className="brand-period">-001</span><small>WEB & DIGITAL STUDIO</small></>}</span>
        </button>
        <nav className={mobileMenu ? "nav-links nav-open" : "nav-links"}>
          {isLiveEventRoute ? <>
            <a href="#overview" onClick={() => setMobileMenu(false)}>Event</a><a href="#format" onClick={() => setMobileMenu(false)}>Details</a><a href="#rules" onClick={() => setMobileMenu(false)}>How to join</a>
          </> : ["site", "templates", "account", "owner", "king-login"].includes(view) ? <>
            <button className={view === "site" ? "nav-text active" : "nav-text"} onClick={() => { setView("site"); setMobileMenu(false); }}>Home</button>
            <button className={view === "templates" ? "nav-text active" : "nav-text"} onClick={() => { setView("templates"); setMobileMenu(false); }}>Templates</button>
            <a href={view === "site" ? "#services" : "/#services"} onClick={() => { setView("site"); setMobileMenu(false); }}>Services</a>
            <a href={view === "site" ? "#process" : "/#process"} onClick={() => { setView("site"); setMobileMenu(false); }}>Process</a>
          </> : <>
            <button className="nav-text active" onClick={() => setView("organizer")}>Overview</button>
            <button className="nav-text" onClick={() => setView("customize")}>Customize</button>
            <button className="nav-text" onClick={() => setView("registrations")}>Registrations</button>
          </>}
        </nav>
        <div className="top-actions">
          {!isLiveEventRoute && <>
            <button type="button" className="owner-shortcut king-login" onClick={() => { setMobileMenu(false); setView(platformRole === "owner" ? "owner" : "king-login"); }} aria-label="King Login — restricted platform owner sign in"><ShieldCheck size={15} /> KING LOGIN</button>
            <button type="button" className="account-entry" onClick={() => { setMobileMenu(false); if (!signedInUser) setView("account"); else if (platformRole === "owner") setView("king-login"); else setView("account"); }} aria-label={signedInUser ? "Open your profile" : "User login"}>{signedInUser ? "MY PROFILE" : "USER LOGIN"} <ArrowRight size={14} /></button>
          </>}
          <button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      {view === "account" ? <AccountPanel initialUser={platformRole === "organizer" ? signedInUser : null} initialOrganizer={organizerWorkspaceSummary} onBack={() => setView("templates")} onOpenWorkspace={openOrganizerWorkspace} onOpenKingLogin={() => setView("king-login")} /> : view === "king-login" ? <KingLoginPanel onBack={() => setView("site")} onSuccess={() => setView("owner")} /> : view === "owner" ? <OwnerPanel onBack={() => setView("site")} /> : view === "templates" ? <TemplateGallery onUseTemplate={handleUseTemplate} /> : view === "site" ? (
        isLiveEventRoute ? <main>
          <section className="hero" id="overview" style={isLiveEventRoute && getSafeHttpsImageUrl(eventData?.branding?.heroBackgroundUrl) ? (() => { const imageUrl = getSafeHttpsImageUrl(eventData?.branding?.heroBackgroundUrl); const overlay = Math.max(0,Math.min(80,Number(eventData?.branding?.heroOverlay) || 0))/100; return { backgroundImage: `linear-gradient(rgba(10,11,18,${overlay}),rgba(10,11,18,${overlay})), url(${JSON.stringify(imageUrl)})`, backgroundSize: "cover", backgroundPosition: ["center center","center top","center bottom","left center","right center","left top","right top","left bottom","right bottom"].includes(eventData?.branding?.heroBackgroundPosition) ? eventData.branding.heroBackgroundPosition : "center center" }; })() : undefined}>
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="eyebrow"><span className="live-pip" /> REGISTRATION OPEN <span className="eyebrow-line" /> SEASON 01</div>
              <h1>{isLiveEventRoute ? (eventData?.title || `${categoryPresentation.heroLine} ${categoryPresentation.heroAccent}`) : <>YOUR NEXT<br /><span className="gradient-text">VICTORY</span> STARTS HERE.</>}</h1>
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

          <section className="ticker" aria-label={isLiveEventRoute ? "Event highlights" : "Tournament highlights"} style={isLiveEventRoute && Array.isArray(eventData?.branding?.pageSections) && !eventData.branding.pageSections.includes("highlights") ? {display:"none"} : undefined}>
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
            <div className="showcase-cta"><div><strong>Have an event idea?</strong><span>Start with a template and customise the details for your audience.</span></div><button className="button button-primary" onClick={() => setView("account")}>Get started free <ArrowRight size={15}/></button></div>
          </section> : null}

          <section className="section event-section" id="format" style={isLiveEventRoute && Array.isArray(eventData?.branding?.pageSections) && !eventData.branding.pageSections.includes("details") ? {display:"none"} : undefined}>
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
            {isLiveEventRoute && (eventData?.branding?.venue || eventData?.branding?.contactEmail || eventData?.branding?.contactPhone) ? <div className="event-contact-strip">{eventData?.branding?.venue ? <div><MapPin size={17}/><span><small>VENUE / LOCATION</small><strong>{eventData.branding.venue}</strong></span></div> : null}{eventData?.branding?.contactEmail ? <a href={"mailto:" + eventData.branding.contactEmail}><Mail size={17}/><span><small>CONTACT EMAIL</small><strong>{eventData.branding.contactEmail}</strong></span></a> : null}{eventData?.branding?.contactPhone ? <a href={"tel:" + eventData.branding.contactPhone}><PhoneCall size={17}/><span><small>CONTACT PHONE</small><strong>{eventData.branding.contactPhone}</strong></span></a> : null}</div> : null}
          </section>

          <section className="section steps-section" id="rules" style={isLiveEventRoute && Array.isArray(eventData?.branding?.pageSections) && !eventData.branding.pageSections.includes("steps") ? {display:"none"} : undefined}>
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
                  {isLiveEventRoute && Array.isArray(eventData?.branding?.registrationFields) ? <div className="form-grid custom-registration-fields">{eventData.branding.registrationFields.slice(0,8).map((field) => <label key={field.id}>{field.label}{field.required ? null : <span className="optional"> (optional)</span>}{field.type==="select"?<select name={"custom_"+field.id} required={Boolean(field.required)} defaultValue=""><option value="">Choose an option</option>{(Array.isArray(field.options)?field.options:[]).slice(0,20).map(option=><option key={option} value={option}>{option}</option>)}</select>:field.type==="textarea"?<textarea name={"custom_"+field.id} required={Boolean(field.required)} maxLength={500} rows={4} placeholder={field.placeholder || "Enter " + String(field.label || "details").toLowerCase()} />:<input name={"custom_" + field.id} type={["text","email","number","tel","date"].includes(field.type) ? field.type : "text"} required={Boolean(field.required)} maxLength={500} placeholder={field.placeholder || "Enter " + String(field.label || "details").toLowerCase()} />}{field.helpText?<small className="custom-field-help">{field.helpText}</small>:null}</label>)}</div> : null}
                  <div className="payment-box"><div className="payment-title"><ShieldCheck size={17} /><span>ENTRY POLICY</span><strong>{eventData?.entry_fee_minor > 0 ? "₹" + (eventData.entry_fee_minor / 100).toFixed(0) : "FREE"}</strong></div>{eventData?.entry_fee_minor > 0 ? <><p>{eventData.payment_instructions || "Follow the organiser's payment instructions, then attach your screenshot for review."}</p>{eventData.payment_qr_public_url ? <img className="payment-qr" src={eventData.payment_qr_public_url} alt="Organiser payment QR code" /> : null}<label className="upload-area"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPaymentScreenshot(e.target.files?.[0] || null)} required /><ImagePlus size={21} /><span><strong>{paymentScreenshot ? paymentScreenshot.name : "Attach payment screenshot"}</strong><small>PNG, JPG or WEBP · maximum 3 MB</small></span><span className="upload-action">{paymentScreenshot ? "Change" : "Browse"}</span></label></> : <p>This event is free to enter. No payment is collected.</p>}</div>
                  {submissionError ? <p className="form-error" role="alert">{submissionError}</p> : null}
                  <label className="consent-check"><input type="checkbox" required /><span>I confirm these details are accurate and agree to the event rules and privacy notice.</span></label>
                  <button className="button button-primary full-width" type="submit" disabled={isSubmitting || (isLiveEventRoute && (!eventData || registrationClosed))}>{isSubmitting ? "Submitting…" : registrationClosed ? "Registration closed" : isLiveEventRoute ? "Submit registration" : "Submit preview registration"} <ArrowRight size={17} /></button>
                  <p className="form-disclaimer"><ShieldCheck size={13} /> {isLiveEventRoute ? "Your registration is sent securely. Payment screenshots are private and must be verified by the organiser." : "Preview only. No payment is collected and no file is uploaded."}</p>
                </form>
              )}
            </div>
          </section>

          <footer className="footer"><button className="brand footer-brand" onClick={() => setView("site")}><span className="brand-mark"><Swords size={17} /></span><span className="brand-word">ARENA<span className="brand-period">.</span><small>POWERED BY COMPANY-001</small></span></button><span>{isLiveEventRoute ? categoryPresentation.label : "Company-001 · Event templates"}</span><button className="footer-link" onClick={() => setView("account")}>Organiser login <ArrowRight size={14} /></button></footer>
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


function TemplateGallery({ onUseTemplate }) {
  const [previewKey, setPreviewKey] = useState(null);
  const templates = [
    { key:"esports-001", name:"eSports Tournament", category:"COMPETITION", icon:Gamepad2, theme:"template-theme-esports", description:"Player registrations, squads, game IDs, match rules and tournament details.", example:"Nexus Open Qualifiers", hero:"YOUR NEXT VICTORY STARTS HERE.", intro:"A tournament page with clear rules, player sign-up and team information.", fields:["Player name","Email address","Game ID / UID","Team name"], highlights:["Tournament overview and rules","Player and squad registration","Entry details and organiser updates"], label:"READY TO COMPETE" },
    { key:"garba-001", name:"Garba & Navratri", category:"CULTURE", icon:Music2, theme:"template-theme-garba", description:"Pass registration, venue information, session timings and attendee notes.", example:"Rang Raas Garba Night", hero:"CELEBRATE TOGETHER.", intro:"A colourful festival website for event details, session choices and attendee registration.", fields:["Attendee name","Email address","Phone number","Pass / session"], highlights:["Festival story and venue details","Date, session and pass information","Attendee registration and instructions"], label:"JOIN THE CELEBRATION" },
    { key:"sports-001", name:"Sports Tournament", category:"SPORTS", icon:Trophy, theme:"template-theme-sports", description:"Team entries, player categories, fixtures, venue and competition rules.", example:"City Champions Cup", hero:"PLAY FOR THE WIN.", intro:"A sports event page for teams, divisions, schedules and match-day instructions.", fields:["Team / participant name","Contact email","Sport / division","Team size"], highlights:["Competition overview and fixtures","Team and player entry details","Venue, schedule and rules"], label:"ENTER THE COMPETITION" },
    { key:"workshop-001", name:"Workshop & Seminar", category:"LEARNING", icon:BookOpen, theme:"template-theme-workshop", description:"Seat reservations, agendas, speaker information and attendee instructions.", example:"Creative Skills Lab", hero:"LEARN SOMETHING NEW.", intro:"A clean workshop page that explains the session and lets attendees reserve a seat.", fields:["Attendee name","Email address","Session / track","Questions for the organiser"], highlights:["Agenda and session details","Speaker and venue information","Seat reservations and attendee notes"], label:"RESERVE YOUR SEAT" },
    { key:"coaching-001", name:"Coaching & Classes", category:"EDUCATION", icon:GraduationCap, theme:"template-theme-coaching", description:"Course enquiries, batch selection, timings and enrolment details.", example:"Foundation Learning Batch", hero:"YOUR NEXT STEP STARTS HERE.", intro:"A course or coaching page for explaining batches, schedules and enrolment enquiries.", fields:["Student name","Contact email","Course / batch","Preferred timing"], highlights:["Course and batch information","Schedule and learning details","Enquiry form for prospective students"], label:"ENQUIRE ABOUT A BATCH" },
    { key:"cultural-001", name:"Cultural Event", category:"PERFORMANCE", icon:Palette, theme:"template-theme-cultural", description:"Performances, auditions, participant categories and event schedules.", example:"Rhythm & Culture Fest", hero:"MAKE IT MEMORABLE.", intro:"A showcase page for performances, auditions, participation categories and schedules.", fields:["Participant name","Email address","Performance / category","Group size"], highlights:["Event programme and categories","Audition or performance registration","Schedule and participant instructions"], label:"BE PART OF THE SHOW" },
    { key:"community-001", name:"Community Meetup", category:"COMMUNITY", icon:HeartHandshake, theme:"template-theme-community", description:"Meetups, club gatherings, volunteering and local community sessions.", example:"Local Creators Meetup", hero:"MEET. SHARE. CONNECT.", intro:"A welcoming page for meetups, community gatherings, volunteer groups and local sessions.", fields:["Attendee name","Email address","Group / session","How would you like to participate?"], highlights:["Meetup purpose and community details","Session and participation options","Attendee registration and updates"], label:"JOIN THE COMMUNITY" },
  ];
  const preview = templates.find((item) => item.key === previewKey);
  return <main className="public-templates-shell">
    <section className="public-templates-hero">
      <div className="section-kicker">COMPANY-001 / PUBLIC TEMPLATE LIBRARY</div>
      <h1>Choose a template.<br/><span className="gradient-text">Preview the whole idea.</span></h1>
      <p>Explore a website concept before signing in. Open a preview, see how the event page and registration flow could look, then use that template to customise your own hosted page.</p>
      <div className="public-template-trust"><span><Globe2 size={15}/> Browse without signing in</span><span><ShieldCheck size={15}/> Drafts stay private</span><span><Sparkles size={15}/> 7 starting layouts</span></div>
    </section>
    <section className="public-template-grid" aria-label="Available event templates">
      {templates.map((template, index) => { const Icon = template.icon; return <article className={"public-template-card " + template.theme} key={template.key}>
        <div className="public-template-art"><span className="public-template-number">0{index + 1} / {template.category}</span><span className="public-template-symbol"><Icon size={34} strokeWidth={1.5}/></span><span className="public-template-art-caption">WEBSITE PREVIEW AVAILABLE</span></div>
        <div className="public-template-body"><h2>{template.name}</h2><p>{template.description}</p><div className="public-template-example"><span>STARTER EXAMPLE</span><strong>{template.example}</strong></div><button className="button button-secondary full-width" onClick={() => setPreviewKey(template.key)}>Preview website <ArrowRight size={15}/></button><button className="button button-primary full-width" onClick={() => onUseTemplate(template.key)}>Use this template <ArrowRight size={15}/></button><small className="public-template-login-note">Preview is public · sign in to customise and save</small></div>
      </article>; })}
    </section>
    <section className="public-template-bottom"><div><span className="section-kicker">READY TO MAKE IT YOURS?</span><h2>Choose a theme. Build your event.</h2><p>Your page will be hosted by Company-001. No separate domain or coding is required.</p></div><button className="button button-primary" onClick={() => onUseTemplate("esports-001")}>Sign in to get started <ArrowRight size={15}/></button></section>
    {preview ? <div className="template-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewKey(null); }}>
      <section className={"template-preview-modal " + preview.theme} role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
        <header className="template-preview-toolbar"><div><span className="template-preview-live-dot"/> INTERACTIVE WEBSITE CONCEPT <span className="template-preview-separator">/</span> {preview.category}</div><button type="button" className="template-preview-close" aria-label="Close template preview" onClick={() => setPreviewKey(null)}><X size={20}/></button></header>
        <div className="template-preview-site">
          <div className="template-preview-nav"><span className="template-preview-brand"><span className="template-preview-brand-mark"><preview.icon size={18}/></span> {preview.example.toUpperCase()}</span><span className="template-preview-nav-link">OVERVIEW</span><span className="template-preview-nav-link">DETAILS</span><span className="template-preview-nav-link">REGISTER</span></div>
          <div className="template-preview-hero"><div className="template-preview-eyebrow"><span/> {preview.label}</div><h2 id="template-preview-title">{preview.hero}</h2><p>{preview.intro}</p><div className="template-preview-hero-actions"><span className="template-preview-cta">{preview.label} <ArrowRight size={14}/></span><span className="template-preview-text-link">Explore event ↓</span></div><div className="template-preview-decoration"><preview.icon size={74} strokeWidth={1.1}/><span className="template-preview-decoration-ring"/></div></div>
          <div className="template-preview-highlights">{preview.highlights.map((highlight, index) => <div key={highlight}><span>0{index+1}</span><strong>{highlight}</strong></div>)}</div>
          <div className="template-preview-registration"><div><span className="template-preview-eyebrow">REGISTRATION FORM CONCEPT</span><h3>Save your place.</h3><p>This sample shows the kind of fields the organiser can configure for their own event.</p></div><div className="template-preview-fields">{preview.fields.map((field) => <label key={field}>{field}<span>{field}</span></label>)}<span className="template-preview-submit">Submit registration <ArrowRight size={14}/></span><small>Example only · this preview does not collect or save information</small></div></div>
        </div>
        <footer className="template-preview-footer"><div><strong>{preview.name}</strong><span>Use this starting layout, then add your own name, colours, event details and form fields.</span></div><button className="button button-primary" onClick={() => onUseTemplate(preview.key)}>Use this template <ArrowRight size={15}/></button></footer>
      </section>
    </div> : null}
  </main>;
}

function KingLoginPanel({ onBack, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("error");
  const [step, setStep] = useState("credentials");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");

  const prepareOwnerMfa = async () => {
    setBusy(true);
    setNotice("");
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verifiedFactor = (factors?.totp || []).find(factor => factor.status === "verified");
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setStep("challenge");
        setNoticeType("success");
        setNotice("Owner identity confirmed. Enter the current code from your authenticator app.");
        return;
      }
      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Company-001 King Login " + new Date().toISOString(),
      });
      if (enrollmentError) throw enrollmentError;
      if (!enrollment?.id || !enrollment?.totp?.qr_code || !enrollment?.totp?.secret) {
        throw new Error("Authenticator setup could not be prepared. Please try again.");
      }
      setFactorId(enrollment.id);
      setQrCode(enrollment.totp.qr_code);
      setTotpSecret(enrollment.totp.secret);
      setStep("enroll");
      setNoticeType("success");
      setNotice("First-time security setup: add this account to your authenticator app, then verify a current six-digit code.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    const resumeOwnerSession = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUser = sessionData.session?.user;
      if (!currentUser) return;
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("platform_role").eq("id", currentUser.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.platform_role !== "owner") return;
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel === "aal2") {
        onSuccess();
        return;
      }
      await prepareOwnerMfa();
    };
    resumeOwnerSession().catch(error => {
      if (active) {
        setNoticeType("error");
        setNotice(error.message || "Could not verify the owner security session.");
        setBusy(false);
      }
    });
    return () => { active = false; };
  }, []);

  const authenticateOwner = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("platform_role").eq("id", data.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.platform_role !== "owner") {
        await supabase.auth.signOut();
        throw new Error("This account does not have platform-owner access. Use Organiser Login instead.");
      }
      await prepareOwnerMfa();
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message || "Could not sign in to the owner panel.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOwnerCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const code = verifyCode.replace(/\s/g, "");
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit code from your authenticator app.");
      if (!factorId) throw new Error("The authenticator session expired. Sign in again to restart setup.");
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel !== "aal2") {
        throw new Error("The second factor was not confirmed. No owner access has been granted.");
      }
      setNoticeType("success");
      setNotice("Two-factor verification complete. Opening the private control panel…");
      onSuccess();
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message || "The authenticator code could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  const leaveKingLogin = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", data.user.id).maybeSingle();
      if (profile?.platform_role === "owner") await supabase.auth.signOut();
    }
    onBack();
  };

  return (
    <main className="account-shell">
      <section className="account-card king-mfa-card">
        <button className="account-back" type="button" onClick={leaveKingLogin}><ArrowRight size={14} /> Back to website</button>
        <div className="section-kicker">COMPANY-001 / RESTRICTED ACCESS</div>
        <h1>King Login.</h1>
        <p className="account-lead">Private platform-owner sign in. Owner access requires your password and a verified authenticator code.</p>
        {step === "credentials" ? (
          <form className="account-form" onSubmit={authenticateOwner}>
            <label>OWNER EMAIL<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" placeholder="Your owner email" /></label>
            <label>PASSWORD<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Your account password" /></label>
            <button className="button button-primary full-width" disabled={busy} type="submit">{busy ? "Verifying owner…" : "Continue to secure verification"} <ShieldCheck size={15} /></button>
          </form>
        ) : (
          <form className="account-form king-mfa-form" onSubmit={verifyOwnerCode}>
            {step === "enroll" ? (
              <div className="king-mfa-setup">
                <h2>Set up your authenticator</h2>
                <p>Scan this QR code with an authenticator app. If scanning is unavailable, enter the setup key manually.</p>
                <img className="king-mfa-qr" src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrCode)} alt="Authenticator setup QR code" />
                <span className="king-mfa-secret-label">MANUAL SETUP KEY</span>
                <code className="king-mfa-secret">{totpSecret}</code>
                <p className="king-mfa-warning">Keep this setup key private. Company-001 does not store a copy of it in your profile.</p>
              </div>
            ) : (
              <div className="king-mfa-setup">
                <h2>Two-factor verification</h2>
                <p>Enter the current six-digit code from your authenticator app to open the owner control panel.</p>
              </div>
            )}
            <label>AUTHENTICATOR CODE<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verifyCode} onChange={event => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required placeholder="000000" /></label>
            <button className="button button-primary full-width" disabled={busy || verifyCode.length !== 6} type="submit">{busy ? "Verifying…" : step === "enroll" ? "Verify & enable MFA" : "Verify & open King Control Room"} <ShieldCheck size={15} /></button>
          </form>
        )}
        {notice ? <p className={noticeType === "success" ? "account-notice" : "owner-alert"} role="status">{notice}</p> : null}
        <p className="account-footnote">Your owner role is checked in Supabase. A password-only session cannot access protected owner data.</p>
      </section>
    </main>
  );
}

function AccountPanel({ initialUser = null, initialOrganizer = null, onBack, onOpenWorkspace, onOpenKingLogin }) {
  const [mode, setMode] = useState("signup");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [organizerCategory, setOrganizerCategory] = useState("esports");
  const [setupOpen, setSetupOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(initialUser);
  const [ownerSessionBlocked, setOwnerSessionBlocked] = useState(false);
  const [organizerWorkspace, setOrganizerWorkspace] = useState(initialOrganizer);
  const [profileDataLoading, setProfileDataLoading] = useState(Boolean(initialUser && !initialOrganizer));
  const [application, setApplication] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() => {
    try {
      if (window.sessionStorage.getItem("company001:google-owner-blocked") === "1") {
        window.sessionStorage.removeItem("company001:google-owner-blocked");
        return "Google sign-in is for organiser accounts only. Use King Login for the platform-owner account.";
      }
    } catch { /* Optional one-time notice. */ }
    return "";
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReauthenticated, setDeleteReauthenticated] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountCurrentPassword, setAccountCurrentPassword] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [changingAccountPassword, setChangingAccountPassword] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState("menu");
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeMenuOnOutsidePress = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setSettingsOpen(false);
    };
    const closeMenuOnEscape = (event) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeMenuOnOutsidePress);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsidePress);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [settingsOpen]);

  useEffect(() => {
    let active = true;
    const syncAccountUser = async (nextUser) => {
      if (!active) return;
      if (!nextUser) {
        setUser(null);
        setOwnerSessionBlocked(false);
        return;
      }
      if (initialUser?.id === nextUser.id) {
        setUser(initialUser);
        setOwnerSessionBlocked(false);
        return;
      }
      const { data: profile, error } = await supabase.from("profiles")
        .select("platform_role").eq("id", nextUser.id).maybeSingle();
      if (!active) return;
      if (error) {
        setUser(null);
        setNotice("Could not verify this account's role. Please try again.");
        return;
      }
      if (profile?.platform_role === "owner") {
        setUser(null);
        setOwnerSessionBlocked(true);
        setNotice("This Gmail belongs to King Login. Normal User access is disabled for this account.");
        return;
      }
      if (profile?.platform_role && profile.platform_role !== "organizer") {
        await supabase.auth.signOut();
        setUser(null);
        setNotice("This account does not have organizer access. Please contact support.");
        return;
      }
      setOwnerSessionBlocked(false);
      setUser(nextUser);
    };

    if (initialUser) {
      setUser(initialUser);
      setOwnerSessionBlocked(false);
    } else {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          if (active) setNotice("Could not verify your sign-in session. Please try again.");
          return;
        }
        void syncAccountUser(data.session?.user ?? null);
      });
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"].includes(event)) return;
      window.setTimeout(() => { void syncAccountUser(session?.user ?? null); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [initialUser?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (window.sessionStorage.getItem("company001:delete-reauth") === user.id) {
        window.sessionStorage.removeItem("company001:delete-reauth");
        setDeleteOpen(true);
        setDeleteReauthenticated(true);
        setNotice("Google sign-in refreshed. Confirm your email and type DELETE to continue.");
      } else if (window.sessionStorage.getItem("company001:password-reauth") === user.id) {
        window.sessionStorage.removeItem("company001:password-reauth");
        setSettingsSection("security");
        setNotice("Google sign-in refreshed. Re-enter your new password and try again.");
      }
    } catch { /* Optional session flag. */ }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setApplication(null);
      setOrganizerWorkspace(null);
      setProfileDataLoading(false);
      return () => { active = false; };
    }

    const isParentVerifiedUser = initialUser?.id === user.id;
    if (initialOrganizer && isParentVerifiedUser) {
      setOrganizerWorkspace(initialOrganizer);
      setProfileDataLoading(false);
    } else {
      setProfileDataLoading(true);
    }

    const organizerRequest = initialOrganizer && isParentVerifiedUser
      ? Promise.resolve({ data: initialOrganizer, error: null })
      : supabase.from("organizers").select("id,display_name,slug,status").eq("owner_user_id", user.id).maybeSingle();
    const applicationRequest = initialOrganizer && isParentVerifiedUser
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("organizer_applications").select("id,business_name,status,decision_note,created_at")
          .eq("applicant_user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const profileWriteRequest = isParentVerifiedUser
      ? Promise.resolve({ error: null })
      : supabase.from("profiles").upsert({
          id: user.id,
          display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Organizer",
          platform_role: "organizer",
        }, { onConflict: "id", ignoreDuplicates: true });

    Promise.all([organizerRequest, applicationRequest, profileWriteRequest]).then(([workspaceResult, applicationResult, profileResult]) => {
      if (!active) return;
      if (workspaceResult.error) {
        setNotice("Could not load your saved workspace. Please refresh and try again.");
      } else {
        setOrganizerWorkspace(workspaceResult.data || null);
      }
      if (!applicationResult.error) setApplication(applicationResult.data || null);
      if (profileResult.error) setNotice("Your account is signed in, but profile setup needs attention. Please contact support.");
    }).catch(() => {
      if (active) setNotice("Could not load your saved profile details. Please refresh and try again.");
    }).finally(() => {
      if (active) setProfileDataLoading(false);
    });

    return () => { active = false; };
  }, [user?.id, initialOrganizer?.id, initialUser?.id]);

  const signInWithGoogle = async () => {
    setBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/?auth_flow=organizer_google",
          // Reuse the browser’s active Google account when possible.
        },
      });
      if (error) throw error;
    } catch (error) {
      setNotice(error.message || "Could not start Google sign-in.");
      setBusy(false);
    }
  };

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
          setNotice("Account created. Set up your workspace to start editing immediately.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("platform_role").eq("id", data.user.id).maybeSingle();
        if (profileError) throw profileError;
        if (profile?.platform_role === "owner") {
          setUser(null);
          setOwnerSessionBlocked(true);
          setNotice("This Gmail belongs to King Login. Normal User access is disabled for this account.");
          return;
        }
        if (profile?.platform_role && profile.platform_role !== "organizer") {
          await supabase.auth.signOut();
          setUser(null);
          throw new Error("This account does not have organiser access. Please contact platform support.");
        }
        if (!profile) {
          const { error: createProfileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            display_name: data.user.user_metadata?.display_name || email.split("@")[0],
            platform_role: "organizer",
          });
          if (createProfileError && createProfileError.code !== "23505") throw createProfileError;
        }
        setUser(data.user);
        const { data: organizer, error: organizerError } = await supabase
          .from("organizers").select("id").eq("owner_user_id", data.user.id).maybeSingle();
        if (organizerError) throw organizerError;
        if (organizer) {
          setNotice("Signed in successfully. Your profile is ready.");
        } else {
          setNotice("Signed in successfully. Complete your organiser workspace setup below to access your websites.");
        }
      }
    } catch (error) {
      setNotice(error.message || "Could not complete account action.");
    } finally { setBusy(false); }
  };

  const refreshOrganizerWorkspace = async () => {
    if (!user?.id) return;
    setBusy(true);
    setNotice("");
    try {
      const [{ data: workspace, error: workspaceError }, { data: latestApplication, error: applicationError }] = await Promise.all([
        supabase.from("organizers").select("id,display_name,slug,status").eq("owner_user_id", user.id).maybeSingle(),
        supabase.from("organizer_applications").select("id,business_name,status,decision_note,created_at")
          .eq("applicant_user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (workspaceError) throw workspaceError;
      if (applicationError) throw applicationError;
      setOrganizerWorkspace(workspace || null);
      setApplication(latestApplication || null);
      setNotice(workspace ? "Workspace is ready. Open My Sites to continue." : "Your workspace is still being activated. Please check again shortly.");
    } catch (error) {
      setNotice(error.message || "Could not refresh your workspace status.");
    } finally {
      setBusy(false);
    }
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
      setNotice("Workspace activated. Opening your template editor…");
      if (data.status === "approved") await onOpenWorkspace(user);
    } catch (error) {
      setNotice(error.message || "Could not submit the organiser application.");
    } finally { setBusy(false); }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setNotice("");
    if (!user?.email) { setNotice("Sign in again before deleting your account."); return; }
    if (deleteConfirmation !== "DELETE") { setNotice("Type DELETE exactly to confirm account removal."); return; }
    if (deleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setNotice("Enter the email address for the signed-in account exactly.");
      return;
    }
    const hasPasswordIdentity = Boolean(
      user.identities?.some(identity => identity.provider === "email") ||
      user.app_metadata?.providers?.includes("email")
    );
    if (!hasPasswordIdentity && !deleteReauthenticated) {
      setNotice("Reconfirm with Google before deleting your account.");
      return;
    }
    setDeletingAccount(true);
    try {
      if (hasPasswordIdentity) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: deletePassword,
        });
        if (reauthError) throw new Error("Password verification failed. Check your password and try again.");
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error("Your session expired. Sign in again and retry.");
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE", email: deleteEmail.trim() },
      });
      if (error) {
        let message = error.message || "Could not delete your account.";
        try {
          const details = await error.context?.json();
          if (details?.error) message = details.error;
        } catch { /* Use the function error message if no response body is available. */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      await supabase.auth.signOut();
      setUser(null);
      setApplication(null);
      setMode("signup");
      setDeleteOpen(false);
      setDeleteEmail("");
      setDeleteConfirmation("");
      setDeleteReauthenticated(false);
      setSettingsOpen(false);
      setSettingsSection("menu");
      setNotice("Your account and linked organiser data have been deleted.");
    } catch (error) {
      setNotice(error.message || "Could not delete your account. Please contact support before retrying.");
    } finally {
      setDeletingAccount(false);
      setDeletePassword("");
    }
  };

  const changeAccountPassword = async (event) => {
    event.preventDefault();
    setNotice("");
    if (!user?.email || !user?.id) {
      setNotice("Please sign in again before changing your password.");
      return;
    }
    if (accountNewPassword.length < 12) {
      setNotice("Choose a new password with at least 12 characters.");
      return;
    }
    if (accountNewPassword !== accountConfirmPassword) {
      setNotice("The new password and confirmation do not match.");
      return;
    }
    const hasPasswordIdentity = Boolean(
      user.identities?.some(identity => identity.provider === "email") ||
      user.app_metadata?.providers?.includes("email")
    );
    if (hasPasswordIdentity && accountNewPassword === accountCurrentPassword) {
      setNotice("Choose a new password that differs from your current password.");
      return;
    }
    setChangingAccountPassword(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session?.user?.id !== user.id) {
        throw new Error("Your sign-in session changed. Please sign in again and retry.");
      }
      if (hasPasswordIdentity) {
        window.sessionStorage.setItem("company001:password-update-reauth", user.id);
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: accountCurrentPassword,
        });
        if (reauthError) {
          window.sessionStorage.removeItem("company001:password-update-reauth");
          throw new Error("Current password is incorrect. Your password was not changed.");
        }
      }
      const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({ password: accountNewPassword });
      if (updateError) {
        if (/reauth|recent login|reauthentication/i.test(updateError.message || "")) {
          throw new Error("For security, sign in again with your connected provider, then return to Settings and retry.");
        }
        throw updateError;
      }
      if (updatedUser?.user) setUser(updatedUser.user);
      setAccountCurrentPassword("");
      setAccountNewPassword("");
      setAccountConfirmPassword("");
      setNotice(hasPasswordIdentity
        ? "Your account password has been changed successfully."
        : "Password created successfully. You can now also sign in with your email and this password.");
    } catch (error) {
      setNotice(error.message || "Could not change your password. Please try again.");
    } finally {
      setChangingAccountPassword(false);
    }
  };

  const reauthenticateGoogleForPassword = async () => {
    setNotice("");
    try {
      window.sessionStorage.setItem("company001:password-reauth", user.id);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/?auth_flow=organizer_google&account_action=password",
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      try { window.sessionStorage.removeItem("company001:password-reauth"); } catch { /* Optional session flag. */ }
      setNotice(error.message || "Could not restart Google sign-in. Please try again.");
    }
  };

  const reauthenticateGoogleForDeletion = async () => {
    setDeleteReauthenticated(false);
    setNotice("");
    try {
      window.sessionStorage.setItem("company001:delete-reauth", user.id);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/?auth_flow=organizer_google&account_action=delete",
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      try { window.sessionStorage.removeItem("company001:delete-reauth"); } catch { /* Optional session flag. */ }
      setNotice(error.message || "Could not restart Google sign-in. Please try again.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setApplication(null);
    setSettingsOpen(false);
    setSettingsSection("menu");
    setDeleteOpen(false);
    setDeleteReauthenticated(false);
    setDeleteEmail("");
    setDeleteConfirmation("");
    setDeletePassword("");
    setAccountCurrentPassword("");
    setAccountNewPassword("");
    setAccountConfirmPassword("");
    setNotice("Signed out.");
  };

  if (ownerSessionBlocked) {
    return (
      <main className="account-shell">
        <section className="account-card" aria-labelledby="owner-user-access-title">
          <div className="section-kicker">COMPANY-001 / ACCOUNT ACCESS</div>
          <h1 id="owner-user-access-title">King Login only.</h1>
          <p className="account-lead">This Gmail is assigned the platform-owner role. It cannot be used as a normal organiser account, and your owner account has not been deleted or changed.</p>
          <div className="account-notice" role="status">Normal User access is disabled for this account.</div>
          <button className="button button-primary full-width" type="button" onClick={onOpenKingLogin}>Open King Login <ArrowRight size={16} /></button>
          <button className="account-back" type="button" onClick={onBack}>Back to website</button>
        </section>
      </main>
    );
  }

  return (
    <main className="account-shell">
      <section className="account-card">
        {!user ? <button className="account-back" onClick={onBack}><ArrowRight size={14} /> Browse public templates</button> : null}
        {!user ? <div className="section-kicker">COMPANY-001 / ORGANISER ACCESS</div> : null}
        {!user ? <h1>{mode === "signup" ? "Start your arena." : "Welcome back."}</h1> : null}
        {!user ? <p className="account-lead">Create an account, set up your organiser workspace, and prepare registration pages for your kind of event.</p> : null}
        {!user ? (
          <>
            <div className="account-tabs"><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setNotice(""); }}>Create account</button><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setNotice(""); }}>Sign in</button></div>
            <button className="account-google-button" type="button" onClick={signInWithGoogle} disabled={busy}><span className="account-google-mark" aria-hidden="true">G</span><span>{busy ? "Connecting…" : "Continue with Google"}</span></button>
            <div className="account-auth-divider"><span>OR USE EMAIL</span></div>
            <form className="account-form" onSubmit={authenticate}>
              {mode === "signup" ? <label>YOUR DISPLAY NAME<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={80} required placeholder="How organisers see your name" /></label> : null}
              <label>EMAIL ADDRESS<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
              <label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>
              <button className="button button-primary full-width" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signup" ? "Create organiser account" : "Sign in"} <ArrowRight size={16} /></button>
            </form>
          </>
        ) : (
          <div className="account-signed-in">
            <section ref={profileMenuRef} className="profile-overview" aria-label="Your profile" style={{ position: "relative" }}>
              <button
                type="button"
                className="menu-button"
                aria-label={settingsOpen ? "Close profile menu" : "Open profile menu"}
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                onClick={() => setSettingsOpen(value => !value)}
                style={{ position: "absolute", top: 14, right: 14, zIndex: 3 }}
              >
                {settingsOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="profile-overview-top" style={{ paddingRight: 48 }}>
                {getSafeHttpsImageUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture)
                  ? <img className="profile-avatar-large" src={getSafeHttpsImageUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture)} alt="Profile" />
                  : <span className="profile-avatar-large">{(user.user_metadata?.display_name || user.email || "O").slice(0, 1).toUpperCase()}</span>}
                <div className="profile-overview-identity">
                  <strong>{user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Organizer"}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <div className="profile-overview-actions" style={{ marginTop: 24 }}>
                {profileDataLoading
                  ? <button className="button button-primary" type="button" disabled aria-busy="true">Loading your sites…</button>
                  : organizerWorkspace
                    ? <button className="button button-primary" onClick={onOpenWorkspace}>My Sites <ArrowRight size={14} /></button>
                    : application && application.status !== "rejected"
                      ? <button className="button button-primary" onClick={refreshOrganizerWorkspace} disabled={busy}>{busy ? "Checking…" : "Refresh status"} <RefreshCw size={14} /></button>
                      : <button className="button button-primary" onClick={() => setSetupOpen(true)}>Create Website <ArrowRight size={14} /></button>}
              </div>
              {settingsOpen ? (
                <div className="profile-settings-menu" role="menu" style={{
                  position: "absolute", top: 58, right: 14, zIndex: 5, minWidth: 190,
                  padding: 8, borderRadius: 14, background: "var(--panel, #171717)",
                  border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 16px 40px rgba(0,0,0,.35)"
                }}>
                  <button type="button" className="profile-settings-item" role="menuitem" onClick={() => { setSettingsOpen(false); setSettingsSection("security"); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px", border: 0, borderRadius: 9, background: "transparent", color: "inherit", textAlign: "left" }}>
                    <Settings size={16} /> Settings
                  </button>
                  <button type="button" className="profile-settings-item" role="menuitem" onClick={signOut}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px", border: 0, borderRadius: 9, background: "transparent", color: "inherit", textAlign: "left" }}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              ) : null}
            </section>
            {application && !organizerWorkspace && !(setupOpen && application.status === "rejected") ? (
              <section className="application-status" aria-label="Organiser setup status">
                <span className="panel-label">ORGANISER SETUP</span>
                <strong>{application.business_name}</strong>
                <span className={"status-chip " + (application.status === "approved" ? "approved" : "pending")}><span />{application.status === "approved" ? "ACTIVE" : application.status.replace(/_/g, " ").toUpperCase()}</span>
                <p>{application.status === "approved" ? "Your organiser workspace is active." : application.status === "rejected" ? (application.decision_note || "Please contact support for the next steps.") : "Your workspace is being activated. Please refresh in a moment if it does not open."}</p>
              </section>
            ) : setupOpen && !organizerWorkspace && (!application || application.status === "rejected") ? (
              <form id="organizer-setup" className="account-form" onSubmit={submitApplication}>
                <label>ORGANISER / COMMUNITY NAME<input value={businessName} onChange={e => setBusinessName(e.target.value)} required minLength={2} maxLength={120} placeholder="Your event or community name" /></label>
                <label>WHAT KIND OF EVENTS DO YOU RUN?<select value={organizerCategory} onChange={e => setOrganizerCategory(e.target.value)} required><option value="esports">eSports tournaments</option><option value="garba">Garba / Navratri</option><option value="sports">Sports tournaments</option><option value="workshop">Workshops / seminars</option><option value="coaching">Coaching / classes</option><option value="cultural">Cultural events</option><option value="community">Community meetups</option></select></label>
                <div className="account-delete-actions">
                  <button className="button button-primary" disabled={busy} type="submit">{busy ? "Setting up…" : "Create Website"} <ArrowRight size={16} /></button>
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => setSetupOpen(false)}>Cancel</button>
                </div>
              </form>
            ) : null}
            {settingsSection === "security" ? (
              <section className="account-password-zone" aria-labelledby="account-password-title">
                <div className="account-delete-heading">
                  <div><span className="panel-label">SETTINGS</span><h3 id="account-password-title">Account security</h3><p>Manage your sign-in details and account access.</p></div>
                  <button type="button" className="button button-secondary" onClick={() => setSettingsSection("menu")}>Close</button>
                </div>
                <form className="account-password-form" onSubmit={changeAccountPassword} autoComplete="off">
                  <h4>Change password</h4>
                  {user.identities?.some(identity => identity.provider === "email") || user.app_metadata?.providers?.includes("email") ? (
                    <label>CURRENT PASSWORD<input type="password" value={accountCurrentPassword} onChange={event => setAccountCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
                  ) : (
                    <div className="account-password-help">
                      <p>You signed in with Google. Create an email password here; your Google sign-in will continue to work.</p>
                      <button className="button button-secondary" type="button" onClick={reauthenticateGoogleForPassword}>Reconfirm with Google</button>
                    </div>
                  )}
                  <label>NEW PASSWORD<input type="password" value={accountNewPassword} onChange={event => setAccountNewPassword(event.target.value)} autoComplete="new-password" minLength={12} required aria-describedby="account-password-help" /></label>
                  <label>CONFIRM NEW PASSWORD<input type="password" value={accountConfirmPassword} onChange={event => setAccountConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} required /></label>
                  <p id="account-password-help" className="account-password-help">Use at least 12 characters and choose a unique password.</p>
                  <button className="button button-primary" type="submit" disabled={changingAccountPassword}>{changingAccountPassword ? "Updating…" : user.identities?.some(identity => identity.provider === "email") || user.app_metadata?.providers?.includes("email") ? "Update password" : "Create password"} <KeyRound size={14}/></button>
                </form>
                <div className="account-delete-zone" aria-labelledby="account-delete-title">
                  <div className="account-delete-heading">
                    <div><h3 id="account-delete-title">Delete account</h3><p>Permanently removes your organiser workspace and its linked data. This cannot be undone.</p></div>
                    {!deleteOpen ? <button type="button" className="account-delete-trigger" onClick={() => { setDeleteOpen(true); setNotice(""); }}>Delete account</button> : null}
                  </div>
                  {deleteOpen ? (
                    <form className="account-delete-form" onSubmit={deleteAccount}>
                      <p className="account-delete-warning">{user.identities?.some(identity => identity.provider === "email") || user.app_metadata?.providers?.includes("email") ? "Confirm your account email, current password, and type DELETE." : "Reconfirm with Google, confirm your account email, and type DELETE."}</p>
                      <label>ACCOUNT EMAIL<input type="email" value={deleteEmail} onChange={event => setDeleteEmail(event.target.value)} autoComplete="email" required /></label>
                      {user.identities?.some(identity => identity.provider === "email") || user.app_metadata?.providers?.includes("email") ? (
                        <label>CURRENT PASSWORD<input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} autoComplete="current-password" required /></label>
                      ) : (
                        <div className="account-password-help">
                          <p>Google accounts must reconfirm with Google before deletion. Your account will not be removed during sign-in.</p>
                          <button className="button button-secondary" type="button" onClick={reauthenticateGoogleForDeletion}>Reconfirm with Google</button>
                        </div>
                      )}
                      <label>TYPE DELETE TO CONFIRM<input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" required /></label>
                      <div className="account-delete-actions">
                        <button className="button button-danger" type="submit" disabled={deletingAccount || !(user.identities?.some(identity => identity.provider === "email") || user.app_metadata?.providers?.includes("email")) && !deleteReauthenticated}>{deletingAccount ? "Deleting…" : "Permanently delete account"}</button>
                        <button className="button button-secondary" type="button" disabled={deletingAccount} onClick={() => { setDeleteOpen(false); setDeleteEmail(""); setDeleteConfirmation(""); setDeletePassword(""); setDeleteReauthenticated(false); }}>Cancel</button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        )}
        {notice ? <p className="account-notice" role="status">{notice}</p> : null}
        {!user ? <p className="account-footnote">Never share your password or payment credentials. Live events still require owner publication review.</p> : null}
      </section>
    </main>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}

createRoot(document.getElementById("root")).render(<App />);
