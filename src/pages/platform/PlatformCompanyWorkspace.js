import { useMemo, useState } from "react";
import DataTable from "../../components/ui/DataTable";
import CollapsiblePanel, { SectionToolbar, useCollapsibleSections } from "../../components/ui/CollapsiblePanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import AuditDetailDialog from "../../components/ui/AuditDetailDialog";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import { generatePassword } from "../../utils/password";
import { modules } from "../../constants/nav";
import { countryName } from "../../constants/countries";
import CompanyProfileFields, { ProfileField } from "./CompanyProfileFields";
import { PLAN_OPTIONS, PlanPicker, planRange, planSummary, withPlanDates } from "./planOptions";

const SECTION_IDS = ["details", "admin", "plan", "features", "audits"];

export function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function moduleLabel(key) {
  return modules[key]?.label || key.replace(/_/g, " ");
}

export function isFeatureLive(feature, today = todayInput()) {
  if (feature.alwaysOn) return true;
  if (!feature.enabled) return false;
  const start = toDateInput(feature.startDate);
  const end = toDateInput(feature.endDate);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

function FeatureModules({ feature }) {
  const items = feature.modules || [];
  if (!items.length) {
    return <p className="mt-1 text-xs text-white/50">Reserved — no screens yet</p>;
  }
  return (
    <ul className="mt-1 space-y-1 text-xs text-white/60">
      {items.map((item) => (
        <li key={item.key}>
          {moduleLabel(item.key)} — {item.actions.join(", ")}
        </li>
      ))}
    </ul>
  );
}

const auditColumns = [
  { accessorKey: "date", header: "When" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "module", header: "Module" },
  { accessorKey: "summary", header: "Summary" },
  { accessorKey: "actorName", header: "Name" },
  { accessorKey: "actorEmail", header: "Email" },
  { accessorKey: "actorRole", header: "Role" },
  { accessorKey: "ip", header: "IP" },
];

export default function PlatformCompanyWorkspace({
  company,
  setCompany,
  features,
  setFeatures,
  admins,
  audits,
  loadingAudits,
  saving,
  onSaveProfile,
  onSaveFeatures,
  onSetStatus,
  onSavePlan,
  onResetAdminPassword,
  onRefreshAudits,
  lockEmail = false,
}) {
  const sections = useCollapsibleSections("platform.company.sections");
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [passwordError, setPasswordError] = useState("");
  const [resettingId, setResettingId] = useState("");
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [planDraft, setPlanDraft] = useState(() =>
    company.plan?.mode
      ? { mode: company.plan.mode, duration: company.plan.duration }
      : { mode: "demo", duration: PLAN_OPTIONS.demo.durations[0] }
  );
  const today = todayInput();

  const granted = useMemo(() => features.filter((item) => isFeatureLive(item, today)), [features, today]);
  const notGranted = useMemo(
    () => features.filter((item) => !isFeatureLive(item, today)),
    [features, today]
  );

  const updateFeature = (key, patch) =>
    setFeatures((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const planForDates = company.plan?.mode ? company.plan : { mode: "none", startDate: today };
  const selectable = features.filter((item) => !item.alwaysOn);
  const toggleAll = (enabled) =>
    setFeatures((list) =>
      withPlanDates(
        list.map((item) => (item.alwaysOn ? item : { ...item, enabled })),
        planForDates
      )
    );

  const saveAdminPassword = async (admin) => {
    const next = String(passwordDrafts[admin.id] || "").trim();
    if (next.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    setPasswordError("");
    setResettingId(admin.id);
    try {
      await onResetAdminPassword(admin.id, next);
      setPasswordDrafts((prev) => ({ ...prev, [admin.id]: "" }));
    } catch (err) {
      setPasswordError(err.message || "Could not update the password.");
    } finally {
      setResettingId("");
    }
  };

  return (
    <>
      <SectionToolbar ids={SECTION_IDS} sections={sections} />

      <CollapsiblePanel
        title="Company details"
        subtitle={[
          `Status: ${company.status}`,
          [company.state, countryName(company.country)].filter(Boolean).join(", "),
          company.timezone,
          company.currency,
        ]
          .filter(Boolean)
          .join(" · ")}
        open={sections.isOpen("details")}
        onToggle={() => sections.toggle("details")}
        actions={
          company.status === "active" ? (
            <button type="button" className={ghostBtn} onClick={() => setConfirmSuspend(true)}>
              Suspend
            </button>
          ) : (
            <button type="button" className={primaryBtn} onClick={() => onSetStatus("active")}>
              Activate
            </button>
          )
        }
      >
        <form className="space-y-4" onSubmit={onSaveProfile}>
          <CompanyProfileFields
            value={company}
            onChange={setCompany}
            lockName
            lockEmail={lockEmail}
            emailInUse={admins.map((item) => item.email).filter(Boolean).join(", ")}
            codeField={
              <ProfileField label="Company code" hint="(fixed after creation)">
                <input className={fieldClass} value={company.code} disabled />
              </ProfileField>
            }
          />
          <div className="flex justify-end">
            <button type="submit" className={primaryBtn} disabled={saving}>
              {saving ? "Saving..." : "Save details"}
            </button>
          </div>
        </form>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Super Admin password"
        subtitle={admins.length ? admins.map((item) => item.email).join(", ") : "No Super Admin yet"}
        open={sections.isOpen("admin")}
        onToggle={() => sections.toggle("admin")}
      >
        {admins.length ? (
          <div className="space-y-5">
            <p className="text-sm text-white/55">
              The stored password is a hash. If this person forgets it, type a new password below.
              Saving replaces the hash, and they sign in with the new password.
            </p>
            {passwordError ? <p className="text-sm text-red-200">{passwordError}</p> : null}
            {admins.map((admin) => (
              <div key={admin.id} className="space-y-3 rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-semibold">
                  {admin.name} <span className="font-normal text-white/55">({admin.email})</span>
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-white/70">Password hash</span>
                  <input className={`${fieldClass} font-mono text-xs`} value={admin.password || ""} readOnly />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-white/70">New password</span>
                  <div className="flex gap-2">
                    <input
                      className={fieldClass}
                      value={passwordDrafts[admin.id] || ""}
                      minLength={6}
                      autoComplete="new-password"
                      onChange={(e) =>
                        setPasswordDrafts((prev) => ({ ...prev, [admin.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className={`${ghostBtn} shrink-0`}
                      onClick={() =>
                        setPasswordDrafts((prev) => ({ ...prev, [admin.id]: generatePassword(12) }))
                      }
                    >
                      Generate
                    </button>
                    <button
                      type="button"
                      className={`${primaryBtn} shrink-0`}
                      disabled={saving || resettingId === admin.id}
                      onClick={() => saveAdminPassword(admin)}
                    >
                      {resettingId === admin.id ? "Saving..." : "Update password"}
                    </button>
                  </div>
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/50">No Super Admin user has been created yet.</p>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Access plan"
        subtitle={`${company.plan?.mode === "demo" ? "Demo mode · " : ""}${planSummary(company.plan)}${
          company.plan?.mode ? ` · ${planRange(company.plan)}` : ""
        }`}
        open={sections.isOpen("plan")}
        onToggle={() => sections.toggle("plan")}
      >
        <p className={`text-sm font-semibold ${company.plan?.expired ? "text-red-300" : "text-brand-teal"}`}>
          {company.plan?.mode === "demo" ? "Demo mode · " : ""}
          {planSummary(company.plan)}
        </p>
        {company.plan?.mode ? <p className="mb-3 text-xs text-white/50">{planRange(company.plan)}</p> : null}
        <p className="mb-3 text-sm text-white/55">
          Change or renew: pick a plan and duration. The new period starts today and every
          feature&apos;s dates move to match it. Ticked features stay as they are.
        </p>
        <PlanPicker value={planDraft} onChange={setPlanDraft} />
        <div className="mt-4 flex justify-end">
          <button type="button" className={primaryBtn} disabled={saving} onClick={() => onSavePlan(planDraft)}>
            {saving ? "Saving..." : company.plan?.mode ? "Update plan" : "Set plan"}
          </button>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Features"
        subtitle={`${selectable.filter((item) => item.enabled).length} of ${selectable.length} selected · ${
          granted.length
        } live today`}
        open={sections.isOpen("features")}
        onToggle={() => sections.toggle("features")}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showSuperAdmin}
              onChange={(e) => setShowSuperAdmin(e.target.checked)}
            />
            Show Super Admin access
          </label>
        }
      >
        <p className="mb-4 text-sm text-white/50">
          Nothing is on until you tick it. Every menu item for this company comes from these
          checkboxes; Super Admin gets every live feature.
        </p>

        {showSuperAdmin ? (
          <div className="mb-4 rounded-2xl bg-white/5 p-4">
            <h3 className="text-sm font-semibold">Super Admin of this company</h3>
            {admins.length ? (
              <p className="mt-1 text-xs text-white/50">
                {admins.map((item) => `${item.name} (${item.email})`).join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/50">No Super Admin user has been created yet.</p>
            )}
            <p className="mt-2 text-xs text-white/55">
              Super Admin bypasses role privileges and has every action on the screens below. Access
              follows the feature checkboxes and dates on this page.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Granted now</p>
                <div className="mt-2 space-y-3">
                  {granted.map((feature) => (
                    <div key={feature.key}>
                      <p className="text-sm font-medium">{feature.name}</p>
                      <FeatureModules feature={feature} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                  Not granted unless you enable the feature
                </p>
                <div className="mt-2 space-y-3">
                  {notGranted.length ? (
                    notGranted.map((feature) => (
                      <div key={feature.key}>
                        <p className="text-sm font-medium text-white/70">{feature.name}</p>
                        <FeatureModules feature={feature} />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/45">All catalog features are enabled.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <label className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={selectable.length > 0 && selectable.every((item) => item.enabled)}
            ref={(el) => {
              if (el) el.indeterminate = selectable.some((item) => item.enabled) && !selectable.every((item) => item.enabled);
            }}
            onChange={(e) => toggleAll(e.target.checked)}
          />
          Select all features
          <span className="font-normal text-white/50">
            ({selectable.filter((item) => item.enabled).length} of {selectable.length} selected)
          </span>
        </label>

        <div className="space-y-2">
          {features.map((feature) => (
            <div key={feature.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
              <label className="flex min-w-[14rem] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={feature.enabled}
                  disabled={feature.alwaysOn}
                  onChange={(e) =>
                    setFeatures((list) =>
                      withPlanDates(
                        list.map((item) =>
                          item.key === feature.key ? { ...item, enabled: e.target.checked } : item
                        ),
                        planForDates
                      )
                    )
                  }
                />
                {feature.name}
                {feature.globalStatus === "inactive" ? " (globally off)" : ""}
              </label>
              {!feature.alwaysOn ? (
                <>
                  <label className="flex items-center gap-2 text-xs font-medium text-white/75">
                    From
                    <input
                      type="date"
                      className={`${fieldClass} max-w-[10rem]`}
                      value={toDateInput(feature.startDate)}
                      onChange={(e) => updateFeature(feature.key, { startDate: e.target.value || null })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-white/75">
                    Until
                    <input
                      type="date"
                      className={`${fieldClass} max-w-[10rem]`}
                      value={toDateInput(feature.endDate)}
                      onChange={(e) => updateFeature(feature.key, { endDate: e.target.value || null })}
                    />
                  </label>
                </>
              ) : (
                <span className="text-xs text-white/45">Always on</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className={primaryBtn} disabled={saving} onClick={onSaveFeatures}>
            {saving ? "Saving..." : "Save features"}
          </button>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Audit report"
        subtitle={`Activity for ${company.name} only · ${audits.length} entries`}
        open={sections.isOpen("audits")}
        onToggle={() => sections.toggle("audits")}
        actions={
          <button type="button" className={ghostBtn} onClick={onRefreshAudits}>
            Refresh
          </button>
        }
      >
        {loadingAudits ? (
          <p className="text-sm text-white/55">Loading audits…</p>
        ) : (
          <DataTable
            columns={auditColumns}
            data={audits}
            searchPlaceholder="Filter this company"
            pageSize={10}
            onRowClick={setSelectedAudit}
          />
        )}
      </CollapsiblePanel>

      <AuditDetailDialog audit={selectedAudit} onClose={() => setSelectedAudit(null)} />

      <ConfirmDialog
        open={confirmSuspend}
        title="Are you sure you want to suspend this account?"
        message={`${company.name} will not be able to sign in until you activate it again.`}
        confirmLabel="Yes, suspend"
        cancelLabel="No, keep Active"
        danger
        onCancel={() => setConfirmSuspend(false)}
        onConfirm={() => {
          setConfirmSuspend(false);
          onSetStatus("suspended");
        }}
      />
    </>
  );
}
