import React, { useState } from "react";
import {
  ArrowRight, ArrowUpRight, Check, Code2, Globe2, LayoutTemplate,
  CalendarDays, ShieldCheck, Sparkles, Workflow, Smartphone, Monitor
} from "lucide-react";

export default function CompanyHome({ onStart, onOrganiser }) {
  const [consultation, setConsultation] = useState({ name: "", email: "", phone: "", project_type: "business-website", requirements: "", preferred_time: "", website: "" });
  const [consultationState, setConsultationState] = useState({ busy: false, error: "", success: "" });
  const submitConsultation = async (event) => {
    event.preventDefault();
    setConsultationState({ busy: true, error: "", success: "" });
    try {
      const response = await fetch("https://zkzgkovwktljfuuuhivk.supabase.co/functions/v1/request-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB" },
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
  return (
    <main className="company-home">
      <section className="company-hero" id="home">
        <div className="company-hero-grid" aria-hidden="true" />
        <div className="company-hero-copy">
          <div className="company-eyebrow"><span /> INDEPENDENT WEB & DIGITAL STUDIO</div>
          <h1>Turn your idea into a <em>website that works.</em></h1>
          <p className="company-hero-lead">Company-001 designs and builds custom websites, focused landing pages and practical digital tools for businesses, creators and event organisers.</p>
          <div className="company-hero-actions">
            <button className="company-button primary" onClick={onStart}>See how projects work <ArrowRight size={17} /></button>
            <a className="company-button secondary" href="#services">Explore services <ArrowUpRight size={16} /></a>
          </div>
          <div className="company-proof"><span><Check size={15} /> Clear scope before work starts</span><span><Check size={15} /> Custom-built to your needs</span></div>
        </div>
        <div className="company-hero-visual" aria-label="Website design and development preview">
          <div className="browser-frame">
            <div className="browser-bar"><span /><span /><span /><small>your-idea.site</small></div>
            <div className="browser-content">
              <div className="browser-mini-brand">YOUR BRAND<span>®</span></div>
              <div className="browser-mini-kicker">A DIGITAL EXPERIENCE, MADE FOR YOU</div>
              <div className="browser-mini-title">Build something<br /><b>remarkable.</b></div>
              <div className="browser-mini-copy" />
              <div className="browser-mini-copy short" />
              <div className="browser-mini-cta">LET'S GET STARTED <ArrowRight size={11} /></div>
              <div className="browser-mini-cards"><span><Globe2 size={17}/><b>Web</b></span><span><Workflow size={17}/><b>Tools</b></span><span><CalendarDays size={17}/><b>Events</b></span></div>
            </div>
          </div>
          <div className="floating-note note-top"><Code2 size={16}/><span><b>Built around your goals</b><small>Not a one-size-fits-all site</small></span></div>
          <div className="floating-note note-bottom"><ShieldCheck size={17}/><span><b>Clear handover</b><small>Hosting and ownership discussed upfront</small></span></div>
          <div className="company-visual-glow" />
        </div>
      </section>

      <section className="company-trust-strip">
        <span>DESIGN</span><i /><span>DEVELOPMENT</span><i /><span>DEPLOYMENT</span><i /><span>SUPPORT</span>
      </section>

      <section className="company-section" id="services">
        <div className="company-section-heading">
          <div><div className="company-kicker">WHAT WE DO</div><h2>Digital work with a <em>clear purpose.</em></h2></div>
          <p>Choose the service that fits your next step. Requirements, price and delivery timeline are discussed before custom development begins.</p>
        </div>
        <div className="company-service-grid">
          <article className="company-service-card featured">
            <div className="company-service-icon"><Monitor size={22}/></div><span className="company-card-label">01 / CUSTOM DEVELOPMENT</span>
            <h3>Websites made for your business.</h3><p>Business websites, service pages and landing pages shaped around your brand, content and goals.</p>
            <ul><li><Check size={14}/> Responsive desktop and mobile layout</li><li><Check size={14}/> Custom features scoped in advance</li><li><Check size={14}/> Hosting and domain setup guidance</li></ul>
            <button onClick={onStart}>View project process <ArrowRight size={15}/></button>
          </article>
          <article className="company-service-card">
            <div className="company-service-icon violet"><LayoutTemplate size={22}/></div><span className="company-card-label">02 / EVENT PLATFORM</span>
            <h3>Event pages without the hassle.</h3><p>A self-service platform for organisers to create event pages, collect registrations and review payment evidence.</p>
            <ul><li><Check size={14}/> Multiple event categories</li><li><Check size={14}/> Organiser-managed details</li><li><Check size={14}/> Review before publication</li></ul>
            <button onClick={onOrganiser}>Explore organiser access <ArrowRight size={15}/></button>
          </article>
          <article className="company-service-card">
            <div className="company-service-icon amber"><Smartphone size={22}/></div><span className="company-card-label">03 / DIGITAL EXPERIENCES</span>
            <h3>Useful tools, not just pages.</h3><p>Purpose-built forms, dashboards and workflows to make a specific business process easier to manage.</p>
            <ul><li><Check size={14}/> Forms and admin views</li><li><Check size={14}/> Database-backed features when needed</li><li><Check size={14}/> Scope and milestones agreed first</li></ul>
            <button onClick={onStart}>View project process <ArrowRight size={15}/></button>
          </article>
        </div>
      </section>

      <section className="company-process-section" id="process">
        <div className="company-section-heading">
          <div><div className="company-kicker">HOW A PROJECT WORKS</div><h2>A clear process from <em>idea to launch.</em></h2></div>
          <p>No surprise scope changes. You review the proposed work and approve the quote before the build begins.</p>
        </div>
        <div className="company-process-grid">
          <article><span>01</span><Sparkles size={19}/><h3>Free consultation</h3><p>Discuss the idea, audience, key pages and must-have features.</p></article>
          <article><span>02</span><LayoutTemplate size={19}/><h3>Scope & quote</h3><p>Receive the agreed deliverables, price, timeline and payment milestones.</p></article>
          <article><span>03</span><Code2 size={19}/><h3>Build & review</h3><p>Review progress against the agreed scope and provide feedback.</p></article>
          <article><span>04</span><Globe2 size={19}/><h3>Launch & handover</h3><p>Deploy the site and clarify access, ownership and any agreed support.</p></article>
        </div>
      </section>


      <section className="company-consultation-section" id="consultation">
        <div className="company-section-heading">
          <div><div className="company-kicker">START A PROJECT</div><h2>Tell us what you want to <em>build.</em></h2></div>
          <p>Share the basics. We will review the idea before discussing scope, budget and timeline. Submitting this form does not commit you to a purchase.</p>
        </div>
        <form className="company-consultation-form" onSubmit={submitConsultation}>
          <div className="company-consultation-fields">
            <label>YOUR NAME<input name="name" value={consultation.name} onChange={updateConsultation} minLength={2} maxLength={100} autoComplete="name" required placeholder="Name" /></label>
            <label>EMAIL ADDRESS<input name="email" type="email" value={consultation.email} onChange={updateConsultation} maxLength={254} autoComplete="email" required placeholder="you@example.com" /></label>
            <label>PHONE (OPTIONAL)<input name="phone" type="tel" value={consultation.phone} onChange={updateConsultation} maxLength={40} autoComplete="tel" placeholder="Preferred contact number" /></label>
            <label>WHAT DO YOU NEED?<select name="project_type" value={consultation.project_type} onChange={updateConsultation} required><option value="business-website">Business website</option><option value="landing-page">Landing page</option><option value="web-app">Web app / custom workflow</option><option value="dashboard">Dashboard or admin panel</option><option value="event-platform">Event platform</option><option value="other">Something else</option></select></label>
            <label className="company-consultation-wide">PROJECT IDEA & MUST-HAVE FEATURES<textarea name="requirements" value={consultation.requirements} onChange={updateConsultation} minLength={15} maxLength={3000} required rows={5} placeholder="What should the website or tool do? Who will use it? Mention any essential features." /></label>
            <label className="company-consultation-wide">PREFERRED TIME TO DISCUSS (OPTIONAL)<input name="preferred_time" value={consultation.preferred_time} onChange={updateConsultation} maxLength={160} placeholder="For example: weekday evenings, India time" /></label>
            <label className="company-honeypot" aria-hidden="true">Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" value={consultation.website} onChange={updateConsultation} /></label>
          </div>
          <button className="company-button primary" type="submit" disabled={consultationState.busy}>{consultationState.busy ? "Sending enquiry…" : "Send project enquiry"} <ArrowRight size={16}/></button>
          {consultationState.error ? <p className="company-form-message error" role="alert">{consultationState.error}</p> : null}
          {consultationState.success ? <p className="company-form-message success" role="status">{consultationState.success}</p> : null}
          <p className="company-form-privacy">Your details are used to respond to this enquiry. Do not include passwords, payment details or other sensitive information.</p>
        </form>
      </section>

      <section className="company-event-callout" id="event-platform">
        <div className="company-event-mark"><CalendarDays size={25}/></div>
        <div className="company-event-copy"><div className="company-kicker">FOR EVENT ORGANISERS</div><h2>Garba night, workshop, sports event or tournament.</h2><p>Choose a category-specific template inside the organiser workspace. The public event page is separate from the Company-001 business website.</p></div>
        <button className="company-button primary" onClick={onOrganiser}>Open organiser workspace <ArrowRight size={16}/></button>
      </section>

      <footer className="company-footer"><div className="company-footer-brand"><span className="company-footer-mark"><Globe2 size={17}/></span><span>COMPANY-001<small>WEB & DIGITAL STUDIO</small></span></div><p>Thoughtful websites. Practical digital tools.</p><button onClick={onStart}>View project process <ArrowRight size={14}/></button></footer>
    </main>
  );
}
