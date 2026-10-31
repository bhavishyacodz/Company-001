import React, { useState } from "react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./services/supabase/client.js";
import {
  ArrowRight, ArrowUpRight, Check, Code2, Globe2, LayoutTemplate,
  CalendarDays, ShieldCheck, Sparkles, Workflow, Smartphone, Monitor,
  MousePointer2, Layers3, WandSparkles, Zap, MoveUpRight
} from "lucide-react";

export default function CompanyHome({ onStart, onOrganiser }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [consultation, setConsultation] = useState({ name: "", email: "", phone: "", project_type: "business-website", requirements: "", preferred_time: "", website: "" });
  const [consultationState, setConsultationState] = useState({ busy: false, error: "", success: "" });
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientY - rect.top) / rect.height - .5) * -8, y: ((event.clientX - rect.left) / rect.width - .5) * 10 });
  };
  return (
    <main className="experience-home">
      <section className="experience-hero" id="home">
        <div className="experience-ambient experience-ambient-one" aria-hidden="true"/>
        <div className="experience-ambient experience-ambient-two" aria-hidden="true"/>
        <div className="experience-hero-inner">
          <div className="experience-hero-copy">
            <div className="experience-eyebrow"><span className="experience-eyebrow-pulse"/> DIGITAL PRODUCTS, BUILT WITH INTENTION <span className="experience-eyebrow-line"/></div>
            <h1>Make your next<br/><span>big idea</span> feel<br/>impossible to ignore.</h1>
            <p className="experience-lead">Websites, event experiences and useful digital tools—designed to make complex things feel effortless.</p>
            <div className="experience-hero-actions">
              <button className="experience-button experience-button-primary" onClick={onOrganiser}>Explore event studio <ArrowUpRight size={18}/></button>
              <a className="experience-button experience-button-ghost" href="#work">Discover what we build <ArrowRight size={16}/></a>
            </div>
            <div className="experience-proof-row"><span><ShieldCheck size={15}/> Built around your workflow</span><span><Zap size={15}/> Fast, responsive experiences</span></div>
          </div>
          <div className="experience-stage-wrap" onPointerMove={moveStage} onPointerLeave={()=>setTilt({x:0,y:0})}>
            <div className="experience-stage-orbit orbit-a"/><div className="experience-stage-orbit orbit-b"/>
            <div className="experience-stage" style={{ transform: "rotateX(" + tilt.x + "deg) rotateY(" + tilt.y + "deg)" }}>
              <div className="experience-stage-back"/>
              <div className="experience-browser">
                <div className="experience-browser-top"><span/><span/><span/><b>studio.company001</b><i><MoveUpRight size={12}/></i></div>
                <div className="experience-browser-body">
                  <div className="experience-browser-nav"><strong>FORM<span> / 001</span></strong><div><i/> <i/> <i/></div></div>
                  <div className="experience-browser-kicker">YOUR EVENT. YOUR WORLD.</div>
                  <div className="experience-browser-title">Create a<br/><em>moment.</em></div>
                  <div className="experience-browser-copy"><span/><span/><span/></div>
                  <div className="experience-browser-cta">BUILD YOUR EXPERIENCE <ArrowUpRight size={12}/></div>
                  <div className="experience-browser-art"><div className="experience-art-disc"/><div className="experience-art-ring"/><div className="experience-art-star">✳</div></div>
                  <div className="experience-browser-foot"><span>DESIGNED TO MOVE</span><span>001 — 2026</span></div>
                </div>
              </div>
              <div className="experience-float-card experience-float-top"><span className="experience-float-icon"><Layers3 size={16}/></span><span><b>One simple workspace</b><small>Every event, in one place</small></span><i><Check size={14}/></i></div>
              <div className="experience-float-card experience-float-bottom"><span className="experience-float-icon"><MousePointer2 size={16}/></span><span><b>Made to feel effortless</b><small>Desktop · Tablet · Mobile</small></span></div>
              <div className="experience-stage-caption">A BETTER WAY TO BUILD <span>↗</span></div>
            </div>
          </div>
        </div>
        <div className="experience-hero-bottom"><span>SCROLL TO EXPLORE <span className="experience-scroll-line"/></span><span>INDEPENDENT DIGITAL STUDIO <b>INDIA · WORLDWIDE</b></span></div>
      </section>

      <section className="experience-marquee" aria-label="Services"><div><span>DESIGN THAT THINKS</span><i>✳</i><span>TECH THAT WORKS</span><i>✳</i><span>EXPERIENCES THAT MOVE</span><i>✳</i><span>DESIGN THAT THINKS</span><i>✳</i></div></section>

      <section className="experience-work" id="work">
        <div className="experience-section-intro"><div><span className="experience-index">01 / WHAT WE MAKE</span><h2>Digital, with a<br/><em>point of view.</em></h2></div><p>Not another template that looks like everyone else's. Thoughtful design, practical technology and a clear purpose behind every interaction.</p></div>
        <div className="experience-work-grid">
          <article className="experience-work-card experience-work-card-large" onClick={onStart} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onStart();}}}>
            <div className="experience-card-top"><span>01 — CUSTOM WEB</span><span className="experience-card-arrow"><ArrowUpRight size={19}/></span></div>
            <div className="experience-web-art"><div className="experience-web-art-window"><div/><div/><div/><b>YOUR BRAND<br/><em>YOUR NEXT CHAPTER.</em></b><span>Explore the possibilities ↗</span></div><div className="experience-web-art-orb"/></div>
            <div className="experience-card-bottom"><div><h3>Websites with<br/>a clear purpose.</h3><p>Distinctive business websites, landing pages and digital storefronts.</p></div><span className="experience-card-link">EXPLORE <ArrowRight size={14}/></span></div>
          </article>
          <article className="experience-work-card experience-work-card-event" onClick={onOrganiser} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onOrganiser();}}}>
            <div className="experience-card-top"><span>02 — EVENT STUDIO</span><span className="experience-card-arrow"><ArrowUpRight size={19}/></span></div>
            <div className="experience-event-art"><div className="experience-event-orbit"/><div className="experience-event-tile"><CalendarDays size={26}/><b>MAKE IT<br/>AN EVENT.</b><small>CREATE · SHARE · MANAGE</small></div><div className="experience-event-chip chip-one">01 / PUBLISH</div><div className="experience-event-chip chip-two">02 / CONNECT</div></div>
            <div className="experience-card-bottom"><div><h3>Your event.<br/>Your own space.</h3><p>Build event pages, collect registrations and manage attendees.</p></div><span className="experience-card-link">OPEN STUDIO <ArrowRight size={14}/></span></div>
          </article>
          <article className="experience-work-card experience-work-card-tools" onClick={onStart} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onStart();}}}>
            <div className="experience-card-top"><span>03 — DIGITAL TOOLS</span><span className="experience-card-arrow"><ArrowUpRight size={19}/></span></div>
            <div className="experience-tools-art"><div className="experience-tool-layer layer-one"><Workflow size={22}/><span>WORKFLOW</span></div><div className="experience-tool-layer layer-two"><Globe2 size={22}/><span>WEB</span></div><div className="experience-tool-layer layer-three"><Sparkles size={22}/><span>IDEAS</span></div></div>
            <div className="experience-card-bottom"><div><h3>Tools that remove<br/>the busywork.</h3><p>Purpose-built dashboards, forms and connected workflows.</p></div><span className="experience-card-link">LET'S BUILD <ArrowRight size={14}/></span></div>
          </article>
        </div>
      </section>

      <section className="experience-process" id="process"><div className="experience-process-head"><span className="experience-index">02 / THE APPROACH</span><h2>Clear steps.<br/><em>No guesswork.</em></h2><p>Good work starts with understanding the problem—not rushing into a build.</p></div><div className="experience-process-list"><article><span>01</span><div><h3>Start with the why.</h3><p>Share your idea, audience and what success should look like.</p></div><Sparkles size={19}/></article><article><span>02</span><div><h3>Shape the experience.</h3><p>Agree the pages, features, scope, timeline and quote first.</p></div><LayoutTemplate size={19}/></article><article><span>03</span><div><h3>Build, test, refine.</h3><p>Review the work as it takes shape and make decisions with clarity.</p></div><Code2 size={19}/></article><article><span>04</span><div><h3>Launch with confidence.</h3><p>Deploy, hand over access and clarify ongoing ownership.</p></div><Globe2 size={19}/></article></div></section>

      <section className="experience-consult" id="consultation"><div className="experience-consult-copy"><span className="experience-index">03 / LET'S TALK</span><h2>Have a good<br/><em>idea?</em></h2><p>Tell us what you're trying to make. We'll help turn the rough idea into a clear plan before you commit to anything.</p><div className="experience-consult-promise"><ShieldCheck size={18}/><span><b>No payment to enquire.</b><small>You'll review the scope and quote before work begins.</small></span></div></div>
        <form className="experience-form" onSubmit={submitConsultation} aria-busy={consultationState.busy}><div className="experience-form-heading"><span>PROJECT ENQUIRY</span><b>Let's make it real <ArrowUpRight size={16}/></b></div><div className="experience-form-grid">
          <label>Your name<input name="name" value={consultation.name} onChange={updateConsultation} minLength={2} maxLength={100} autoComplete="name" required placeholder="Name"/></label>
          <label>Email address<input name="email" type="email" value={consultation.email} onChange={updateConsultation} maxLength={254} autoComplete="email" required placeholder="you@example.com"/></label>
          <label>Phone (optional)<input name="phone" type="tel" value={consultation.phone} onChange={updateConsultation} maxLength={40} autoComplete="tel" placeholder="Contact number"/></label>
          <label>What are you building?<select name="project_type" value={consultation.project_type} onChange={updateConsultation} required><option value="business-website">Business website</option><option value="landing-page">Landing page</option><option value="web-app">Web app / custom workflow</option><option value="dashboard">Dashboard or admin panel</option><option value="event-platform">Event platform</option><option value="other">Something else</option></select></label>
          <label className="experience-form-wide">Tell us about the idea<textarea name="requirements" value={consultation.requirements} onChange={updateConsultation} minLength={15} maxLength={3000} required rows={4} placeholder="What should it do? Who will use it? What matters most?"/></label>
          <label className="experience-form-wide">Preferred time (optional)<input name="preferred_time" value={consultation.preferred_time} onChange={updateConsultation} maxLength={160} placeholder="For example: weekday evenings, India time"/></label>
          <label className="experience-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" value={consultation.website} onChange={updateConsultation}/></label>
        </div><button className="experience-button experience-button-primary" type="submit" disabled={consultationState.busy}>{consultationState.busy ? "Sending…" : "Send project enquiry"} <ArrowRight size={17}/></button>
        {consultationState.error ? <p className="experience-form-message error" role="alert">{consultationState.error}</p> : null}{consultationState.success ? <p className="experience-form-message success" role="status">{consultationState.success}</p> : null}
        <p className="experience-form-privacy">Your details are used only to respond to this enquiry. Do not include passwords or payment details.</p></form></section>

      <footer className="experience-footer"><div className="experience-footer-brand"><span>001</span><b>COMPANY-001<small>INDEPENDENT DIGITAL STUDIO</small></b></div><p>Make useful things. Make them feel good.</p><div><a href="#home">BACK TO TOP ↑</a><span>© 2026 COMPANY-001</span></div></footer>
    </main>
  );
}
