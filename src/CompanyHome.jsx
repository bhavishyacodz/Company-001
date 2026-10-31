import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, Check, Code2, Globe2, LayoutTemplate,
  CalendarDays, ShieldCheck, Sparkles, Workflow, Smartphone, Monitor,
  MousePointer2, Layers3, WandSparkles, Zap, MoveUpRight, Menu, X,
  ShoppingBag, Palette, Users, BookOpen, MapPin, Send, CircleHelp
} from "lucide-react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./services/supabase/client.js";

export default function CompanyHome({ onStart, onOrganiser, onTemplates }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const [consultation, setConsultation] = useState({ name: "", email: "", phone: "", project_type: "business-website", requirements: "", preferred_time: "", website: "" });
  const [consultationState, setConsultationState] = useState({ busy: false, error: "", success: "" });

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const submitConsultation = async (event) => {
    event.preventDefault();
    setConsultationState({ busy: true, error: "", success: "" });
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/request-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(consultation),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send your enquiry. Please try again.");
      setConsultationState({ busy: false, error: "", success: "Enquiry received" + (result.reference ? " · Reference " + result.reference : "") + ". We will review your project details." });
      setConsultation({ name: "", email: "", phone: "", project_type: "business-website", requirements: "", preferred_time: "", website: "" });
    } catch (error) {
      setConsultationState({ busy: false, error: error.message || "Could not send your enquiry. Please try again.", success: "" });
    }
  };
  const updateConsultation = (event) => setConsultation(current => ({ ...current, [event.target.name]: event.target.value }));
  const moveStage = (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientY - rect.top) / rect.height - .5) * -5, y: ((event.clientX - rect.left) / rect.width - .5) * 7 });
  };
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="experience-home tactile-home">
      <section className="tactile-frame" id="home">
        <div className="tactile-canvas">
          <div className="tactile-grain" aria-hidden="true" />
          <header className="tactile-nav">
            <button className="tactile-brand-pill" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Company-001 home">
              <span className="tactile-brand-mark">001</span>
              <span>COMPANY<span className="tactile-brand-dash">—</span>001</span>
            </button>
            <nav className="tactile-center-pill" aria-label="Main navigation">
              <button onClick={onTemplates}>Catalog</button>
              <span aria-hidden="true" />
              <a href="#manifesto">Manifesto</a>
            </nav>
            <div className="tactile-nav-actions" ref={menuRef}>
              <button className="tactile-icon-button" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="tactile-menu">
                {menuOpen ? <X size={19}/> : <Menu size={19}/>}
              </button>
              <button className="tactile-icon-button tactile-bag-button" onClick={onOrganiser} aria-label="Open organiser workspace" title="Open organiser workspace">
                <ShoppingBag size={18}/>
                <span className="tactile-bag-dot" />
              </button>
              {menuOpen && <div className="tactile-popover" id="tactile-menu">
                <div className="tactile-promo">
                  <div><span>MADE TO MAKE THINGS HAPPEN</span><strong>Good ideas<br/>look good here.</strong><button onClick={() => { closeMenu(); onTemplates(); }}>Explore templates <ArrowUpRight size={14}/></button></div>
                  <div className="tactile-promo-art" aria-hidden="true"><span/><i>✳</i><b>001</b></div>
                </div>
                <div className="tactile-menu-grid">
                  <a className="wide" href="#services" onClick={closeMenu}>Event studio <ArrowUpRight size={14}/></a>
                  <a className="wide" href="#process" onClick={closeMenu}>How it works <ArrowUpRight size={14}/></a>
                  <a href="#manifesto" onClick={closeMenu}>Our approach</a>
                  <a href="#stories" onClick={closeMenu}>What we make</a>
                  <a href="#faq" onClick={closeMenu}>FAQ</a>
                  <a href="#contact" onClick={closeMenu}>Contact</a>
                  <button className="wide" onClick={() => { closeMenu(); onOrganiser(); }}>Open your workspace <ArrowRight size={14}/></button>
                </div>
              </div>}
            </div>
          </header>

          <div className="tactile-hero-copy">
            <span className="tactile-kicker"><i/> INDEPENDENT DIGITAL STUDIO <b>INDIA · WORLDWIDE</b></span>
            <h1>Big ideas.<br/><em>Beautifully</em> put<br/>into motion.</h1>
            <p>Build a website, bring an event to life, or turn a messy workflow into something wonderfully simple.</p>
            <div className="tactile-hero-actions">
              <button className="tactile-primary-button" onClick={onTemplates}>Explore the catalog <ArrowUpRight size={17}/></button>
              <button className="tactile-text-button" onClick={onOrganiser}>Open your studio <ArrowRight size={16}/></button>
            </div>
            <div className="tactile-proof"><span><ShieldCheck size={15}/> Privacy-first by design</span><span><Zap size={15}/> Made to feel effortless</span></div>
          </div>

          <div className="tactile-mascot-stage" onPointerMove={moveStage} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
            <div className="tactile-orbit orbit-one"/><div className="tactile-orbit orbit-two"/>
            <div className="tactile-mascot-shadow"/>
            <div className="tactile-mascot" style={{ transform: "rotateX(" + tilt.x + "deg) rotateY(" + tilt.y + "deg)" }} aria-label="A friendly 3D-style mascot waving hello">
              <div className="mascot-arm mascot-arm-left"/>
              <div className="mascot-arm mascot-arm-right"><i/></div>
              <div className="mascot-body"><span className="mascot-eye eye-left"/><span className="mascot-eye eye-right"/><span className="mascot-cheek cheek-left"/><span className="mascot-cheek cheek-right"/><span className="mascot-smile"/></div>
              <span className="mascot-spark spark-a">✳</span><span className="mascot-spark spark-b">✦</span>
            </div>
            <div className="tactile-floating-note note-left"><Layers3 size={16}/><span><b>One clear workspace</b><small>Everything in its place</small></span><Check size={15}/></div>
            <div className="tactile-floating-note note-right"><MousePointer2 size={16}/><span><b>Easy by design</b><small>Phone · tablet · desktop</small></span></div>
          </div>
          <div className="tactile-canvas-foot"><span>DESIGN THAT THINKS <i>✳</i> TECH THAT WORKS</span><a href="#services">SCROLL TO EXPLORE ↓</a></div>
        </div>

        <div className="tactile-bento-grid" id="services">
          <button className="tactile-bento-card bento-web" onClick={onStart}>
            <span className="tactile-card-index">01 / CUSTOM WEB</span><span className="tactile-card-arrow"><ArrowUpRight size={19}/></span>
            <h2>Make your<br/>brand feel<br/>like <em>you.</em></h2>
            <p>Distinctive websites and digital storefronts with a clear point of view.</p>
            <span className="tactile-doodle doodle-star" aria-hidden="true">✳</span>
            <span className="tactile-card-cta">BUILD SOMETHING <ArrowRight size={14}/></span>
          </button>
          <button className="tactile-bento-card bento-events" onClick={onTemplates}>
            <span className="tactile-card-index">02 / EVENT STUDIO</span><span className="tactile-card-arrow"><ArrowUpRight size={19}/></span>
            <h2>Your event.<br/>Your own<br/><em>world.</em></h2>
            <p>Publish event pages, collect registrations and keep every detail together.</p>
            <span className="tactile-doodle doodle-face" aria-hidden="true"><i/><b/><em/></span>
            <span className="tactile-card-cta">EXPLORE TEMPLATES <ArrowRight size={14}/></span>
          </button>
        </div>
      </section>

      <section className="tactile-manifesto" id="manifesto">
        <div><span className="tactile-section-index">03 / THE MANIFESTO</span><h2>Less friction.<br/><em>More feeling.</em></h2></div>
        <p>Technology should make the next step obvious. We bring thoughtful design and practical tools together, so people can focus on what they came to do—not figure out the interface.</p>
        <div className="tactile-manifesto-stamp"><Sparkles size={22}/><b>MADE WITH<br/>INTENTION</b><span>001</span></div>
      </section>

      <section className="tactile-services" id="stories">
        <div className="tactile-section-heading"><div><span className="tactile-section-index">04 / WHAT WE MAKE</span><h2>Useful things.<br/><em>Lovely details.</em></h2></div><p>Purpose-built experiences for people with something worth sharing.</p></div>
        <div className="tactile-service-grid">
          <article className="tactile-service-card service-site"><span className="tactile-service-icon"><Globe2 size={20}/></span><span className="tactile-service-label">01 — WEB DESIGN</span><h3>Websites with<br/>a clear purpose.</h3><p>Business sites, landing pages and digital storefronts shaped around your brand.</p><span className="tactile-service-art"><Monitor size={46}/><i/></span></article>
          <article className="tactile-service-card service-event"><span className="tactile-service-icon"><CalendarDays size={20}/></span><span className="tactile-service-label">02 — EVENT TOOLS</span><h3>Bring people<br/>together.</h3><p>Registration pages, attendee lists and organiser tools that stay in sync.</p><span className="tactile-service-art"><Users size={46}/><i/></span></article>
          <article className="tactile-service-card service-workflow"><span className="tactile-service-icon"><Workflow size={20}/></span><span className="tactile-service-label">03 — DIGITAL WORKFLOWS</span><h3>Make busywork<br/>disappear.</h3><p>Useful dashboards, connected forms and calmer everyday processes.</p><span className="tactile-service-art"><WandSparkles size={46}/><i/></span></article>
        </div>
      </section>

      <section className="tactile-process" id="process">
        <div className="tactile-process-intro"><span className="tactile-section-index">05 / A SIMPLE PROCESS</span><h2>Clear steps.<br/><em>No guesswork.</em></h2><p>Good work starts with understanding the problem—not rushing into a build.</p></div>
        <div className="tactile-process-list">
          <article><b>01</b><div><h3>Tell us the idea.</h3><p>Share your audience, goals and what success should feel like.</p></div><Sparkles size={20}/></article>
          <article><b>02</b><div><h3>Shape the experience.</h3><p>Agree the pages, features, scope and timeline before we build.</p></div><LayoutTemplate size={20}/></article>
          <article><b>03</b><div><h3>Build, test, refine.</h3><p>Review the work as it takes shape and improve the details.</p></div><Code2 size={20}/></article>
          <article><b>04</b><div><h3>Launch with confidence.</h3><p>Deploy, hand over access and clarify ongoing ownership.</p></div><Globe2 size={20}/></article>
        </div>
      </section>

      <section className="tactile-faq" id="faq"><span className="tactile-section-index">06 / GOOD TO KNOW</span><h2>Questions, <em>answered.</em></h2><div><details><summary>Can organisers browse templates without signing in?<ArrowRight size={16}/></summary><p>Yes. The public template catalog is designed to be explored before creating an account.</p></details><details><summary>Can I manage my event from my phone?<ArrowRight size={16}/></summary><p>The experience is designed for mobile and desktop, with responsive organiser tools.</p></details><details><summary>Who can see participant details?<ArrowRight size={16}/></summary><p>Participant information and payment evidence are intended to remain private to the event's organiser.</p></details></div></section>

      <section className="tactile-contact" id="contact">
        <div className="tactile-contact-copy"><span className="tactile-section-index">07 / LET'S TALK</span><h2>Have a good<br/><em>idea?</em></h2><p>Tell us what you're trying to make. We'll help turn the rough idea into a clear plan before you commit to anything.</p><div className="tactile-contact-promise"><ShieldCheck size={18}/><span><b>No payment to enquire.</b><small>Review the scope and quote before work begins.</small></span></div></div>
        <form className="tactile-form" onSubmit={submitConsultation} aria-busy={consultationState.busy}>
          <div className="tactile-form-heading"><span>PROJECT ENQUIRY</span><b>Let's make it real <Send size={16}/></b></div>
          <div className="tactile-form-grid">
            <label>Your name<input name="name" value={consultation.name} onChange={updateConsultation} minLength={2} maxLength={100} autoComplete="name" required placeholder="Name"/></label>
            <label>Email address<input name="email" type="email" value={consultation.email} onChange={updateConsultation} maxLength={254} autoComplete="email" required placeholder="you@example.com"/></label>
            <label>Phone (optional)<input name="phone" type="tel" value={consultation.phone} onChange={updateConsultation} maxLength={40} autoComplete="tel" placeholder="Contact number"/></label>
            <label>What are you building?<select name="project_type" value={consultation.project_type} onChange={updateConsultation} required><option value="business-website">Business website</option><option value="landing-page">Landing page</option><option value="web-app">Web app / custom workflow</option><option value="dashboard">Dashboard or admin panel</option><option value="event-platform">Event platform</option><option value="other">Something else</option></select></label>
            <label className="tactile-form-wide">Tell us about the idea<textarea name="requirements" value={consultation.requirements} onChange={updateConsultation} minLength={15} maxLength={3000} required rows={4} placeholder="What should it do? Who will use it? What matters most?"/></label>
            <label className="tactile-form-wide">Preferred time (optional)<input name="preferred_time" value={consultation.preferred_time} onChange={updateConsultation} maxLength={160} placeholder="For example: weekday evenings, India time"/></label>
            <label className="tactile-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" value={consultation.website} onChange={updateConsultation}/></label>
          </div>
          <button className="tactile-primary-button" type="submit" disabled={consultationState.busy}>{consultationState.busy ? "Sending…" : "Send project enquiry"} <ArrowRight size={17}/></button>
          {consultationState.error ? <p className="tactile-form-message error" role="alert">{consultationState.error}</p> : null}
          {consultationState.success ? <p className="tactile-form-message success" role="status">{consultationState.success}</p> : null}
          <p className="tactile-form-privacy">Your details are used only to respond to this enquiry. Do not include passwords or payment details.</p>
        </form>
      </section>

      <footer className="tactile-footer"><button className="tactile-footer-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span>001</span><b>COMPANY-001<small>INDEPENDENT DIGITAL STUDIO</small></b></button><p>Make useful things. Make them feel good.</p><div><a href="#home">BACK TO TOP ↑</a><span>© 2026 COMPANY-001</span></div></footer>
    </main>
  );
}
