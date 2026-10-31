import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowUpRight, Check, HardDrive, Image, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import "./plan-usage.css";

const supabase = createClient(
  "https://zkzgkovwktljfuuuhivk.supabase.co",
  "sb_publishable__hHhbTYbvfL3TPa-_JHxQQ_EI9A_kTB"
);

const PLANS = {
  free: { name: "Free pilot", price: "₹0", cadence: "forever", storage: 40_000_000, screenshots: 40, maxFile: 1_000_000, forms: 1, responses: 100 },
  starter: { name: "Starter", price: "₹199", cadence: "/ month", storage: 200_000_000, screenshots: null, maxFile: 3_000_000, forms: 3, responses: 250 },
  business: { name: "Business", price: "₹499", cadence: "/ month", storage: 1_000_000_000, screenshots: null, maxFile: 3_000_000, forms: 10, responses: 500 },
};

const mb = (bytes) => (bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1);
const safePlan = (key) => PLANS[key] ? key : "free";

export default function PlanUsagePanel({ organizer, events, registrations, usage, user, onRefresh }) {
  const [requesting, setRequesting] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const planKey = safePlan(organizer?.plan_key);
  const current = PLANS[planKey];
  const usedBytes = Math.max(0, Number(usage?.bytes) || 0);
  const evidenceCount = Math.max(0, Number(usage?.files) || 0);
  const storageLimit = Number(organizer?.storage_quota_bytes) || current.storage;
  const maxFile = Number(organizer?.max_screenshot_bytes) || current.maxFile;
  const maxScreenshots = Number(organizer?.max_screenshots) || current.screenshots || 40;
  const maxForms = Number(organizer?.max_forms) || current.forms;
  const maxResponses = Number(organizer?.max_responses_per_form) || current.responses;
  const percent = Math.min(100, Math.round((usedBytes / Math.max(storageLimit, 1)) * 100));
  const requestUpgrade = async (key) => {
    if (!user?.email || !organizer?.id || key === planKey) return;
    setRequesting(key); setMessage(""); setError("");
    try {
      const plan = PLANS[key];
      const { data, error: invokeError } = await supabase.functions.invoke("request-consultation", {
        body: {
          name: organizer.display_name || user.email.split("@")[0],
          email: user.email,
          phone: "",
          project_type: "event-platform",
          requirements: "COMPANY-001 PLAN UPGRADE REQUEST\nRequested plan: " + plan.name + " (" + plan.price + " " + plan.cadence + ").\nOrganizer workspace: " + organizer.slug + "\nCurrent plan: " + current.name + ".\nPlease contact me to confirm availability and next steps. No payment has been made.",
          preferred_time: "Please contact by email",
          website: ""
        }
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setMessage("Upgrade request sent. Your current plan stays active until the owner confirms the upgrade.");
    } catch (e) {
      setError(e.message || "Could not send the upgrade request. Please try again.");
    } finally {
      setRequesting("");
    }
  };

  return (
    <section className="plan-usage-panel" aria-labelledby="plan-usage-title">
      <div className="plan-usage-heading">
        <div>
          <span className="plan-usage-kicker">03 / YOUR PLAN & STORAGE</span>
          <h2 id="plan-usage-title">Know what you have. Plan what comes next.</h2>
          <p>Your forms and responses stay in your workspace. Screenshot storage is shared infrastructure, with a separate allowance for each organiser.</p>
        </div>
        <button className="plan-refresh-button" type="button" onClick={onRefresh}><RefreshCw size={14}/> Refresh usage</button>
      </div>

      <div className="plan-usage-overview">
        <div className="plan-current-card">
          <div className="plan-current-top"><span className="plan-current-icon"><ShieldCheck size={17}/></span><span>CURRENT PLAN</span><b>{current.name}</b></div>
          <div className="plan-current-price">{current.price}<small>{current.cadence}</small></div>
          <p>{planKey === "free" ? "Your founding pilot allowance. No automatic charge." : "Your upgraded organiser allowance."}</p>
          <div className="plan-current-stats">
            <div><strong>{events.length} / {maxForms}</strong><span>Forms created</span></div>
            <div><strong>{registrations.length}</strong><span>Responses loaded</span></div>
            <div><strong>{evidenceCount} / {maxScreenshots}</strong><span>Payment screenshots</span></div>
          </div>
        </div>
        <div className="plan-storage-card">
          <div className="plan-storage-top"><span><HardDrive size={17}/> PRIVATE SCREENSHOT STORAGE</span><strong>{percent}%</strong></div>
          <div className="plan-storage-numbers"><strong>{mb(usedBytes)} MB</strong><span>of {mb(storageLimit)} MB used</span></div>
          <div className="plan-storage-track"><span style={{ width: percent + "%" }}/></div>
          <div className="plan-storage-foot"><span>{evidenceCount} files counted</span><span>Max {mb(maxFile)} MB per file</span></div>
          {percent >= 90 ? <p className="plan-storage-warning">You are close to your storage limit. Export what you need and review older screenshots before collecting more.</p> : <p className="plan-storage-note">Export your responses, save any screenshot you need from Payments, then use Delete screenshot to free storage. Response records stay in your dashboard.</p>}
        </div>
      </div>

      <div className="plan-included-strip">
        <span><Image size={15}/> {maxFile === 1_000_000 ? "1 MB max per screenshot" : mb(maxFile) + " MB max per screenshot"}</span>
        <span><Check size={15}/> {maxResponses.toLocaleString("en-IN")} responses per form</span>
        <span><Check size={15}/> {maxForms} form{maxForms === 1 ? "" : "s"}</span>
        <span><Sparkles size={15}/> Export your response data</span>
      </div>

      <div className="plan-cards">
        {Object.entries(PLANS).map(([key, plan]) => (
          <article className={"plan-card " + (key === planKey ? "is-current" : "")} key={key}>
            <div className="plan-card-top"><span>{key === "free" ? "START HERE" : key === "starter" ? "GROWING ORGANISERS" : "BUSIER EVENTS"}</span>{key === planKey ? <b><Check size={12}/> CURRENT</b> : null}</div>
            <h3>{plan.name}</h3>
            <div className="plan-card-price">{plan.price}<small>{plan.cadence}</small></div>
            <ul>
              <li>{plan.forms} published form{plan.forms === 1 ? "" : "s"}</li>
              <li>{plan.responses.toLocaleString("en-IN")} responses per form</li>
              <li>{plan.screenshots ? plan.screenshots.toLocaleString("en-IN") + " screenshots" : key === "starter" ? "200 screenshots" : "1,000 screenshots"}</li>
              <li>{mb(plan.storage)} MB screenshot storage</li>
              <li>{mb(plan.maxFile)} MB maximum per screenshot</li>
            </ul>
            {key === planKey ? <span className="plan-current-label"><Check size={14}/> Your active plan</span> : <button type="button" className="plan-request-button" disabled={Boolean(requesting)} onClick={() => requestUpgrade(key)}>{requesting === key ? "Sending request…" : "Request this plan"} <ArrowUpRight size={14}/></button>}
          </article>
        ))}
      </div>
      {message ? <p className="plan-request-success" role="status">{message}</p> : null}
      {error ? <p className="plan-request-error" role="alert">{error}</p> : null}
      <p className="plan-usage-footnote">Plan requests are reviewed manually. No payment is collected here, and your allowance changes only after the owner confirms capacity and activates the plan. Initial platform pilot target: 10 organisers and a 500 MB shared storage budget.</p>
    </section>
  );
}
