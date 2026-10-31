import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, Users, LayoutDashboard, Inbox, UserCheck, CalendarCheck, Shield, RefreshCw, Building2, ShieldCheck, Activity, LogOut, KeyRound, Search, Ban, Trash2, RotateCcw, UserRoundCog } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import OwnerEventReview from "./OwnerEventReview.jsx";
import OwnerAuditLog from "./OwnerAuditLog.jsx";
import OrganizerAccessPanel from "./OrganizerAccessPanel.jsx";
// Keep the King Control Room redesign above nested legacy component styles.
import "./experience-redesign.css";
import "./finance-ledger.css";

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
  const [financeEntries, setFinanceEntries] = useState([]);
  const [financeForm, setFinanceForm] = useState({ entry_type: "income", category: "subscription", amount: "", organizer_id: "", note: "" });
  const [savingFinance, setSavingFinance] = useState(false);
  const [platformStorageCapMB, setPlatformStorageCapMB] = useState("500");
  const [savingStorageCap, setSavingStorageCap] = useState(false);
  const [counts, setCounts] = useState({ events: 0, pendingEvents: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [planBusyId, setPlanBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [consultationFilter, setConsultationFilter] = useState("all");
  const [consultationSearch, setConsultationSearch] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [accountError, setAccountError] = useState("");
  const [accountBusyId, setAccountBusyId] = useState("");
  const [accountActionTarget, setAccountActionTarget] = useState(null);
  const [accountConfirmEmail, setAccountConfirmEmail] = useState("");
  const [accountConfirmWord, setAccountConfirmWord] = useState("");

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
      const [appResult, organizerResult, eventResult, consultationResult, pendingEventResult, financeResult, storageSettingsResult] = await Promise.all([
        supabase.from("organizer_applications").select("id,applicant_user_id,business_name,category,contact_email,notes,status,decision_note,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("organizers").select("id,owner_user_id,display_name,slug,status,created_at,plan_key,storage_quota_bytes,max_screenshot_bytes,max_screenshots,max_forms,max_responses_per_form").order("created_at", { ascending: false }).limit(100),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("consultation_requests").select("id,name,email,phone,project_type,requirements,preferred_time,status,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("platform_finance_entries").select("id,entry_type,category,amount_paise,note,organizer_id,recorded_by,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("platform_storage_settings").select("screenshot_quota_bytes").eq("id", 1).maybeSingle()
      ]);
      if (appResult.error) throw appResult.error;
      if (organizerResult.error) throw organizerResult.error;
      if (eventResult.error) throw eventResult.error;
      if (consultationResult.error) throw consultationResult.error;
      if (pendingEventResult.error) throw pendingEventResult.error;
      if (financeResult.error) throw financeResult.error;
      if (storageSettingsResult.error) throw storageSettingsResult.error;
      setConsultationRequests(consultationResult.data || []);
      setApplications(appResult.data || []);
      setOrganizers(organizerResult.data || []);
      setCounts({ events: eventResult.count || 0, pendingEvents: pendingEventResult.count || 0 });
      setFinanceEntries(financeResult.data || []);
      setPlatformStorageCapMB(String(Math.round((Number(storageSettingsResult.data?.screenshot_quota_bytes) || 500000000) / 1000000)));
      const { data: accountData, error: accountLoadError } = await supabase.functions.invoke("manage-user-accounts", { body: { action: "list" } });
      if (accountLoadError) {
        setAccountError(accountLoadError.message || "Could not load user accounts.");
        setAccounts([]);
      } else if (accountData?.error) {
        setAccountError(accountData.error);
        setAccounts([]);
      } else {
        setAccounts(Array.isArray(accountData?.users) ? accountData.users : []);
        setAccountError("");
      }
    } catch (e) {
      setError(e.message || "Could not load the owner workspace.");
    } finally { setLoading(false); }
  };

  const changeOrganizerPlan = async (organizer, planKey) => {
    const plans = {
      free: { storage_quota_bytes: 40000000, max_screenshot_bytes: 1000000, max_screenshots: 40, max_forms: 1, max_responses_per_form: 100 },
      starter: { storage_quota_bytes: 200000000, max_screenshot_bytes: 3000000, max_screenshots: 200, max_forms: 3, max_responses_per_form: 250 },
      business: { storage_quota_bytes: 1000000000, max_screenshot_bytes: 3000000, max_screenshots: 1000, max_forms: 10, max_responses_per_form: 500 }
    };
    if (!plans[planKey] || organizer.plan_key === planKey) return;
    if (!window.confirm("Change " + organizer.display_name + " to the " + planKey.toUpperCase() + " plan? Only do this after checking payment and available platform storage.")) return;
    setPlanBusyId(organizer.id); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("organizers").update({
        plan_key: planKey, ...plans[planKey], plan_activated_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq("id", organizer.id);
      if (updateError) throw updateError;
      const { error: auditError } = await supabase.from("audit_logs").insert({
        actor_user_id: user.id, organizer_id: organizer.id, action: "organizer_plan_changed",
        target_type: "organizer", target_id: organizer.id,
        metadata: { previous_plan: organizer.plan_key || "free", plan_key: planKey, limits: plans[planKey] }
      });
      setNotice("Plan updated for " + organizer.display_name + "." + (auditError ? " Warning: the audit log could not be saved." : ""));
      await load();
    } catch (e) {
      setError(e.message || "Could not update the organiser plan.");
    } finally { setPlanBusyId(""); }
  };

  const saveFinanceEntry = async (event) => {
    event.preventDefault();
    const amount = Number(financeForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      setError("Enter a valid amount greater than ₹0.");
      return;
    }
    setSavingFinance(true); setError(""); setNotice("");
    try {
      const { error: insertError } = await supabase.from("platform_finance_entries").insert({
        entry_type: financeForm.entry_type,
        category: financeForm.category,
        amount_paise: Math.round(amount * 100),
        note: financeForm.note.trim(),
        organizer_id: financeForm.organizer_id || null,
        recorded_by: user.id
      });
      if (insertError) throw insertError;
      setFinanceForm({ entry_type: "income", category: "subscription", amount: "", organizer_id: "", note: "" });
      setNotice("Finance entry saved. Allocation figures have been refreshed.");
      await load();
    } catch (e) {
      setError(e.message || "Could not save the finance entry.");
    } finally { setSavingFinance(false); }
  };

  const savePlatformStorageCap = async (event) => {
    event.preventDefault();
    const megabytes = Number(platformStorageCapMB);
    if (!Number.isFinite(megabytes) || megabytes < 1 || megabytes > 100000) {
      setError("Enter a shared storage cap between 1 MB and 100,000 MB.");
      return;
    }
    if (!window.confirm("Save a shared screenshot cap of " + megabytes.toLocaleString("en-IN") + " MB? Only increase this after the Supabase storage allowance has actually been upgraded. This setting does not purchase storage.")) return;
    setSavingStorageCap(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("platform_storage_settings").update({
        screenshot_quota_bytes: Math.round(megabytes * 1000000),
        updated_at: new Date().toISOString(),
        updated_by: user.id
      }).eq("id", 1);
      if (updateError) throw updateError;
      setNotice("Shared screenshot capacity updated. Existing organiser quotas remain unchanged.");
      await load();
    } catch (e) {
      setError(e.message || "Could not update shared screenshot capacity.");
    } finally { setSavingStorageCap(false); }
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setError(signOutError.message || "Could not sign out."); return; }
    setUser(null);
    setRole(null);
    onBack();
  };

  const openAccountAction = (account, action) => {
    setAccountActionTarget({ account, action });
    setAccountConfirmEmail("");
    setAccountConfirmWord("");
    setAccountError("");
    setError("");
    setNotice("");
  };

  const runAccountAction = async (event) => {
    event.preventDefault();
    if (!accountActionTarget) return;
    const { account, action } = accountActionTarget;
    if (accountConfirmEmail.trim().toLowerCase() !== account.email.trim().toLowerCase()) {
      setAccountError("Enter the account's exact email address to confirm this action.");
      return;
    }
    if (action === "delete" && accountConfirmWord !== "DELETE") {
      setAccountError("Type DELETE to permanently remove this account.");
      return;
    }
    setAccountBusyId(account.id);
    setAccountError("");
    setNotice("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("manage-user-accounts", {
        body: {
          action,
          userId: account.id,
          email: accountConfirmEmail.trim(),
          ...(action === "delete" ? { confirmation: accountConfirmWord } : {}),
        },
      });
      if (invokeError) throw new Error(invokeError.message || "The account action could not be completed.");
      if (data?.error) throw new Error(data.error);
      setNotice(data?.message || (action === "delete" ? "Account deleted." : action === "suspend" ? "Account suspended." : "Account restored."));
      setAccountActionTarget(null);
      setAccountConfirmEmail("");
      setAccountConfirmWord("");
      await load();
    } catch (e) {
      setAccountError(e.message || "Account action failed. Refresh the list before retrying.");
    } finally {
      setAccountBusyId("");
    }
  };

  const visibleAccounts = accounts.filter(account => {
    const query = accountSearch.trim().toLowerCase();
    const matchesQuery = !query || [account.email, account.displayName, account.role,
      ...(account.workspaces || []).map(workspace => workspace.display_name)]
      .some(value => String(value || "").toLowerCase().includes(query));
    const matchesFilter = accountFilter === "all" ||
      (accountFilter === "suspended" ? account.suspended : !account.suspended);
    return matchesQuery && matchesFilter;
  });

  const changeOwnerPassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!user?.email || role !== "owner") {
      setError("Only a verified owner session can change this password.");
      return;
    }
    if (newPassword.length < 12) {
      setError("Choose a new password with at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password that differs from your current password.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) throw new Error("Current password is incorrect. Your password was not changed.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("King Login password changed successfully. Use the new password next time you sign in.");
    } catch (e) {
      setError(e.message || "Could not change the password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
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
  if (loading) return <main className="owner-shell"><div className="owner-wrap"><section className="owner-card" role="status"><div className="section-kicker">COMPANY-001 / KING CONTROL ROOM</div><h1>Verifying owner access…</h1><p>Checking your signed-in account before loading private platform data.</p></section></div></main>;
  if (!user || role !== "owner") return <main className="owner-shell"><div className="owner-wrap"><section className="owner-card" role="alert"><div className="section-kicker">RESTRICTED AREA</div><h1>King access required</h1><p>This dashboard is only available to the authenticated platform-owner account. Sign in through King Login to continue.</p><button className="button button-primary" onClick={onBack}>Back to website <ArrowRight size={14}/></button></section></div></main>;
  return (
    <main className="owner-shell">
      <div className="owner-wrap">
        <header className="owner-heading"><div><div className="section-kicker owner-live-kicker"><span className="owner-live-dot" /> COMPANY-001 / KING CONTROL ROOM</div><h1>Good to have you back.</h1><p>Your platform command centre. Review activity, manage access, approve events and keep everything organised from one place.</p></div><div className="owner-heading-actions"><span className="owner-secure-label"><ShieldCheck size={14}/> OWNER ACCESS</span><button className="button button-secondary" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh data</button><button className="button button-secondary" onClick={onBack}>Public site <ExternalLink size={14} /></button><button className="button button-secondary" onClick={signOut}><LogOut size={14}/> Sign out</button></div></header>
        <nav className="owner-command-nav" aria-label="Owner dashboard sections">
          <a href="#owner-overview"><LayoutDashboard size={16}/><span>Overview</span></a>
          <a href="#owner-enquiries"><Inbox size={16}/><span>Enquiries</span><b>{newConsultationCount}</b></a>
          <a href="#owner-finance"><WalletCards size={16}/><span>Finance & reinvestment</span></a>
          <a href="#owner-applications"><UserCheck size={16}/><span>Organiser approvals</span><b>{applications.filter(a => a.status === "pending").length}</b></a>
          <a href="#owner-access"><Shield size={16}/><span>Access control</span></a>
          <a href="#owner-events"><CalendarCheck size={16}/><span>Event publishing</span><b>{counts.pendingEvents}</b></a>
          <a href="#owner-organisers"><Building2 size={16}/><span>Organisers</span></a>
          <a href="#owner-user-accounts"><UserRoundCog size={16}/><span>User accounts</span><b>{accounts.length}</b></a>
          <a href="#owner-security"><KeyRound size={16}/><span>Login security</span></a>
          <a href="#owner-activity"><Activity size={16}/><span>Activity log</span></a>
        </nav>
        <section id="owner-overview" className="owner-overview-intro"><div><span className="panel-label">YOUR DAILY CHECKLIST</span><h2>Everything important, in one place.</h2><p>Use the shortcuts below instead of scrolling through the whole dashboard.</p></div><div className="owner-overview-status"><span className="owner-live-dot"/> <span>Secure owner session</span></div></section>
        <div className="owner-metrics">
          <div className="owner-metric"><span>ORGANIZER WORKSPACES</span><strong>{organizers.length}</strong><small>Active and suspended accounts</small></div>
          <div className="owner-metric"><span>APPROVED ORGANISERS</span><strong>{organizers.filter(o => o.status === "approved").length}</strong><small>Active organiser accounts</small></div>
          <div className="owner-metric"><span>EVENTS TO REVIEW</span><strong>{counts.pendingEvents}</strong><small>Awaiting publication decision</small></div>
          <div className="owner-metric"><span>ALL EVENTS</span><strong>{counts.events}</strong><small>Total event records</small></div>
        </div>
        <section id="owner-finance" className="owner-card">
          <div className="owner-section-head"><div><span className="panel-label">01 / FINANCE & REINVESTMENT</span><h2>Money in. Costs out. Growth planned.</h2><p>Record confirmed plan payments and actual expenses. The allocation below is a planning guide only; it does not move money automatically.</p></div></div>
          <div className="owner-inbox-summary">
            <div><strong>₹{(financeEntries.filter(entry => entry.entry_type === "income").reduce((sum, entry) => sum + Number(entry.amount_paise || 0), 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong><span>Recorded income</span></div>
            <div><strong>₹{(financeEntries.filter(entry => entry.entry_type === "expense").reduce((sum, entry) => sum + Number(entry.amount_paise || 0), 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong><span>Recorded expenses</span></div>
            <div><strong>₹{((financeEntries.reduce((sum, entry) => sum + (entry.entry_type === "income" ? 1 : -1) * Number(entry.amount_paise || 0), 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong><span>Remaining balance</span></div>
          </div>
          <form className="owner-storage-cap-control" onSubmit={savePlatformStorageCap}>
            <div><span className="panel-label">PLATFORM CAPACITY CONTROL</span><h3>Shared screenshot storage</h3><p>Current pilot cap: {Number(platformStorageCapMB).toLocaleString("en-IN")} MB. Increase this only after the Supabase storage plan has been upgraded and verified. The database and upload service both enforce this value.</p></div>
            <label>New shared cap (MB)<input type="number" min="1" max="100000" step="1" value={platformStorageCapMB} onChange={event => setPlatformStorageCapMB(event.target.value)}/></label>
            <button className="button button-primary" type="submit" disabled={savingStorageCap}>{savingStorageCap ? "Saving…" : "Save shared capacity"}</button>
          </form>
          <div className="owner-finance-allocation">
            <div><span className="panel-label">SUGGESTED SPLIT OF RECORDED INCOME</span><p>Use this as a budget guide after confirming receipts. Review actual costs before spending.</p></div>
            {[
              ["Infrastructure", 50, "#4b94d1"],
              ["Emergency reserve", 20, "#4ba77a"],
              ["Product development", 20, "#a18bd4"],
              ["Fees & refunds reserve", 10, "#d1a34d"]
            ].map(([label, percent, color]) => {
              const income = financeEntries.filter(entry => entry.entry_type === "income").reduce((sum, entry) => sum + Number(entry.amount_paise || 0), 0) / 100;
              const amount = income * Number(percent) / 100;
              return <div className="owner-finance-allocation-row" key={label}>
                <span><i style={{ background: color }}/>{label}</span><strong>₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong><small>{percent}%</small>
                <div className="owner-finance-bar"><span style={{ width: percent + "%", background: color }}/></div>
              </div>;
            })}
          </div>
          <form className="owner-finance-form" onSubmit={saveFinanceEntry}>
            <div><span className="panel-label">RECORD A REAL TRANSACTION</span><h3>Add income or expense</h3><p>Only record money actually received or spent. Plan upgrades remain manual.</p></div>
            <label>Entry type<select value={financeForm.entry_type} onChange={event => setFinanceForm(current => ({ ...current, entry_type: event.target.value, category: event.target.value === "income" ? "subscription" : "infrastructure" }))}><option value="income">Income received</option><option value="expense">Expense paid</option></select></label>
            <label>Category<select value={financeForm.category} onChange={event => setFinanceForm(current => ({ ...current, category: event.target.value }))}>{financeForm.entry_type === "income" ? <><option value="subscription">Premium subscription</option><option value="founding-pilot">Founding pilot payment</option><option value="other-income">Other income</option></> : <><option value="infrastructure">Hosting / infrastructure</option><option value="payment-fee">Payment fee</option><option value="refund">Refund</option><option value="development">Product development</option><option value="other-expense">Other expense</option></>}</select></label>
            <label>Amount (₹)<input type="number" min="0.01" max="100000000" step="0.01" value={financeForm.amount} onChange={event => setFinanceForm(current => ({ ...current, amount: event.target.value }))} required placeholder="500"/></label>
            <label>Related organiser (optional)<select value={financeForm.organizer_id} onChange={event => setFinanceForm(current => ({ ...current, organizer_id: event.target.value }))}><option value="">Not linked to an organiser</option>{organizers.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
            <label className="owner-finance-note">Note<input value={financeForm.note} onChange={event => setFinanceForm(current => ({ ...current, note: event.target.value }))} maxLength={500} placeholder="e.g. Starter plan payment confirmed"/></label>
            <button className="button button-primary" type="submit" disabled={savingFinance}>{savingFinance ? "Saving…" : "Save finance entry"}</button>
          </form>
          <div className="owner-finance-ledger"><div className="owner-section-head"><div><span className="panel-label">RECENT TRANSACTIONS</span><h3>Finance ledger</h3></div><span className="owner-muted">Latest 200 entries</span></div>
            {financeEntries.length === 0 ? <p className="owner-muted">No transactions recorded yet. When a plan payment is actually received or a bill is paid, record it here.</p> : <div className="owner-table-wrap"><table><thead><tr><th>TYPE</th><th>CATEGORY</th><th>AMOUNT</th><th>NOTE</th><th>DATE</th></tr></thead><tbody>{financeEntries.map(entry => <tr key={entry.id}><td><span className={"status-chip " + (entry.entry_type === "income" ? "approved" : "pending")}><span/>{entry.entry_type}</span></td><td>{entry.category.replaceAll("-", " ")}</td><td><strong>{entry.entry_type === "income" ? "+" : "−"}₹{(Number(entry.amount_paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></td><td>{entry.note || "—"}</td><td>{new Date(entry.created_at).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>}
          </div>
        </section>
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
        <section id="owner-organisers" className="owner-card"><div className="owner-section-head"><div><span className="panel-label">07 / WORKSPACE & PLAN MANAGEMENT</span><h2>Organisers and plans</h2><p>Manage each organiser's allowance. Only activate a paid plan after confirming payment and checking that platform storage capacity is available.</p></div></div><div className="owner-inbox-summary"><div><strong>{organizers.filter(o => (o.plan_key || "free") === "free").length} / 10</strong><span>Free pilot workspaces</span></div><div><strong>{organizers.filter(o => o.plan_key === "starter").length}</strong><span>Starter workspaces</span></div><div><strong>{organizers.filter(o => o.plan_key === "business").length}</strong><span>Business workspaces</span></div></div>{organizers.length === 0 ? <p className="owner-muted">No organiser workspaces have been created yet.</p> : <div className="owner-table-wrap"><table><thead><tr><th>ORGANISER</th><th>PUBLIC SLUG</th><th>STATUS</th><th>PLAN</th><th>STORAGE</th><th>CHANGE PLAN</th></tr></thead><tbody>{organizers.map(o => <tr key={o.id}><td>{o.display_name}</td><td><code>{o.slug}</code></td><td><span className={"status-chip " + (o.status === "approved" ? "approved" : "pending")}><span />{o.status}</span></td><td><strong>{(o.plan_key || "free").toUpperCase()}</strong></td><td>{((Number(o.storage_quota_bytes) || 40000000) / 1000000).toFixed(0)} MB</td><td><select aria-label={"Change plan for " + o.display_name} value={o.plan_key || "free"} disabled={Boolean(planBusyId)} onChange={event => changeOrganizerPlan(o, event.target.value)}><option value="free">Free · ₹0</option><option value="starter">Starter · ₹199/mo</option><option value="business">Business · ₹499/mo</option></select>{planBusyId === o.id ? <small>Saving…</small> : null}</td></tr>)}</tbody></table></div>}<p className="owner-muted">Plan changes are manual. The website does not collect subscription payments yet. The 500 MB pilot-wide screenshot ceiling remains in force until storage capacity is deliberately increased.</p></section>
        <section id="owner-user-accounts" className="owner-module-anchor">
          <div className="owner-module-heading"><span className="panel-label">08 / ACCOUNT ADMINISTRATION</span><h2>User accounts</h2><p>Search every registered account, temporarily suspend access, restore suspended users, or permanently delete an account and its linked organiser data. Owner accounts are protected.</p></div>
          <div className="owner-card owner-user-admin">
            <div className="owner-user-admin-summary"><div><span className="panel-label">REGISTERED ACCOUNTS</span><strong>{accounts.length}</strong></div><div><span className="panel-label">ACTIVE</span><strong>{accounts.filter(account => !account.suspended).length}</strong></div><div><span className="panel-label">SUSPENDED</span><strong>{accounts.filter(account => account.suspended).length}</strong></div><button className="button button-secondary" onClick={load} disabled={loading || Boolean(accountBusyId)}><RefreshCw size={14}/> Refresh users</button></div>
            <div className="owner-user-admin-filters"><label><span>Search accounts</span><div className="owner-user-search"><Search size={15}/><input type="search" value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Email, name, role or workspace" aria-label="Search user accounts"/></div></label><label><span>Account status</span><select value={accountFilter} onChange={event => setAccountFilter(event.target.value)} aria-label="Filter user accounts"><option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label></div>
            {accountError ? <p className="owner-alert" role="alert">{accountError}</p> : null}
            {accountActionTarget ? <form className="owner-user-confirm" onSubmit={runAccountAction}>
              <div><span className="panel-label">CONFIRM ACCOUNT ACTION</span><h3>{accountActionTarget.action === "delete" ? "Permanently delete this account?" : accountActionTarget.action === "suspend" ? "Suspend this account?" : "Restore this account?"}</h3><p>{accountActionTarget.action === "delete" ? "This permanently deletes the user's login, organiser workspaces, published/draft events, registrations and private payment-evidence files linked to those workspaces. This cannot be undone." : accountActionTarget.action === "suspend" ? "This blocks future sign-ins until you restore the account. The user's data is kept." : "This removes the sign-in ban so the user can access their account again."}</p><strong>{accountActionTarget.account.displayName} · {accountActionTarget.account.email}</strong></div>
              <label>TYPE THE ACCOUNT EMAIL TO CONFIRM<input type="email" value={accountConfirmEmail} onChange={event => setAccountConfirmEmail(event.target.value)} autoComplete="off" required placeholder={accountActionTarget.account.email}/></label>
              {accountActionTarget.action === "delete" ? <label>TYPE DELETE TO CONFIRM<input value={accountConfirmWord} onChange={event => setAccountConfirmWord(event.target.value)} autoComplete="off" required placeholder="DELETE"/></label> : null}
              <div className="owner-user-confirm-actions"><button className={accountActionTarget.action === "delete" ? "button button-danger" : "button button-primary"} type="submit" disabled={Boolean(accountBusyId)}>{accountBusyId ? "Working…" : accountActionTarget.action === "delete" ? "Permanently delete account" : accountActionTarget.action === "suspend" ? "Suspend account" : "Restore account"}</button><button className="button button-secondary" type="button" disabled={Boolean(accountBusyId)} onClick={() => {setAccountActionTarget(null);setAccountConfirmEmail("");setAccountConfirmWord("");}}>Cancel</button></div>
            </form> : null}
            {loading && accounts.length === 0 ? <p className="owner-muted">Loading registered accounts…</p> : visibleAccounts.length === 0 ? <div className="owner-empty"><Users size={22}/><strong>No matching accounts.</strong><p>Try a different search or status filter.</p></div> : <div className="owner-user-account-list">{visibleAccounts.map(account => <article className={"owner-user-account " + (account.suspended ? "is-suspended" : "")} key={account.id}>
              <div className="owner-user-account-top"><div className="owner-user-avatar">{String(account.displayName || account.email || "U").slice(0,1).toUpperCase()}</div><div className="owner-user-account-identity"><strong>{account.displayName}</strong><span>{account.email || "No email address"}</span><small>Joined {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "date unavailable"} · {account.lastSignInAt ? "Last sign-in " + new Date(account.lastSignInAt).toLocaleDateString() : "No recorded sign-in"}</small></div><span className={"owner-user-state " + (account.suspended ? "suspended" : "active")}>{account.suspended ? "SUSPENDED" : "ACTIVE"}</span></div>
              <div className="owner-user-account-meta"><span>Role: <strong>{account.role}</strong></span>{account.workspaces?.length ? <span>Workspaces: <strong>{account.workspaces.map(workspace => workspace.display_name).join(", ")}</strong></span> : <span>No organiser workspace</span>}{account.role === "owner" ? <span className="owner-muted">Protected owner account</span> : null}</div>
              {account.role !== "owner" && account.id !== user?.id ? <div className="owner-user-account-actions">{account.suspended ? <button className="button button-primary" disabled={Boolean(accountBusyId)} onClick={() => openAccountAction(account,"restore")}><RotateCcw size={14}/> Restore account</button> : <button className="button button-secondary" disabled={Boolean(accountBusyId)} onClick={() => openAccountAction(account,"suspend")}><Ban size={14}/> Suspend account</button>}<button className="button button-danger" disabled={Boolean(accountBusyId)} onClick={() => openAccountAction(account,"delete")}><Trash2 size={14}/> Delete account</button></div> : null}
            </article>)}</div>}
            <p className="owner-muted">Suspending keeps account data but blocks authentication. Deletion is permanent. Both actions require the exact account email; deletion additionally requires typing DELETE.</p>
          </div>
        </section>
        <section id="owner-security" className="owner-module-anchor"><div className="owner-module-heading"><span className="panel-label">08 / ACCOUNT SECURITY</span><h2>King Login password</h2><p>Change the password for your current owner account. Your current password is verified before the new one is saved.</p></div><div className="owner-card owner-security-card"><form className="account-form" onSubmit={changeOwnerPassword} autoComplete="off"><label>CURRENT PASSWORD<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required minLength={1} /></label><label>NEW PASSWORD<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={12} aria-describedby="owner-password-guidance" /></label><label>CONFIRM NEW PASSWORD<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={12} /></label><p id="owner-password-guidance" className="owner-muted">Use at least 12 characters. A unique passphrase is recommended. Do not reuse your website or email password.</p><button className="button button-primary" type="submit" disabled={changingPassword}>{changingPassword ? "Updating password…" : "Change King Login password"} <KeyRound size={14}/></button></form></div></section>
        <section id="owner-activity" className="owner-module-anchor"><div className="owner-module-heading"><span className="panel-label">08 / AUDIT & ACCOUNTABILITY</span><h2>Activity log</h2><p>See recorded moderation and access-control history.</p></div><OwnerAuditLog /></section>
        {error ? <p className="owner-alert" role="alert">{error}</p> : null}
        {notice ? <p className="account-notice" role="status">{notice}</p> : null}
        <p className="owner-muted">Signed in as {user.email}. Owner actions are checked by Supabase, not just by this screen.</p>
      </div>
    </main>
  );
}
