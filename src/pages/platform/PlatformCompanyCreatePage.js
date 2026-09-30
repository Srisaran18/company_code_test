import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { PageIntro } from "../../components/ui/GlassPanel";
import CollapsiblePanel, { SectionToolbar, useCollapsibleSections } from "../../components/ui/CollapsiblePanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import CompanyProfileFields, { ProfileField, profilePayload } from "./CompanyProfileFields";
import { PLAN_OPTIONS, PlanPicker } from "./planOptions";

const SECTION_IDS = ["details", "plan", "admin"];

const emptyForm = {
  code: "",
  name: "",
  legalName: "",
  taxNumber: "",
  country: "SA",
  state: "",
  city: "",
  postalCode: "",
  address: "",
  timezone: "Asia/Riyadh",
  currency: "SAR",
  email: "",
  phone: "",
  adminName: "",
  adminEmail: "",
  plan: { mode: "demo", duration: 5 },
};

export default function PlatformCompanyCreatePage() {
  const navigate = useNavigate();
  const isPlatformAdmin = useSelector((state) => state.auth.user?.isPlatformAdmin === true);
  const sections = useCollapsibleSections("platform.create.sections");
  const [form, setForm] = useState(emptyForm);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    api
      .get("/platform/features")
      .then((data) => {
        setCatalog(data.features || []);
        if (data.nextCompanyCode) setForm((current) => ({ ...current, code: current.code || data.nextCompanyCode }));
      })
      .catch((err) => setError(err.message));
  }, [isPlatformAdmin]);

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  const onProfileChange = (next) => setForm(next);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await api.post("/platform/companies", {
        ...profilePayload(form),
        code: form.code,
        plan: form.plan,
        features: catalog.filter((item) => item.alwaysOn).map((item) => item.key),
        admin: form.adminEmail ? { email: form.adminEmail, name: form.adminName } : undefined,
      });
      navigate(`/platform/${data.company.id}`, {
        replace: true,
        state: {
          message: data.adminPasswordEmailed
            ? `Company created. Admin password was sent to ${form.adminEmail}.`
            : data.adminPassword
              ? `Company created. Admin password (shown once): ${data.adminPassword}`
              : "Company created.",
        },
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const option = PLAN_OPTIONS[form.plan.mode];

  return (
    <div className="space-y-5">
      <PageIntro kicker="Platform" title="Add company">
        <Link to="/platform" className="mt-2 inline-block text-sm text-brand-teal hover:underline">
          Back to companies
        </Link>
      </PageIntro>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <SectionToolbar ids={SECTION_IDS} sections={sections} />

        <CollapsiblePanel
          title="Company details"
          subtitle={[form.name, form.code, form.timezone, form.currency].filter(Boolean).join(" · ")}
          open={sections.isOpen("details")}
          onToggle={() => sections.toggle("details")}
        >
          <CompanyProfileFields
            value={form}
            onChange={onProfileChange}
            codeField={
              <ProfileField label="Company code" hint="(numeric)">
                <input
                  className={fieldClass}
                  value={form.code}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Auto number"
                  onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "").slice(0, 20) })}
                />
              </ProfileField>
            }
          />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Access plan"
          subtitle={`${option.label} · ${form.plan.duration} ${option.unit}`}
          open={sections.isOpen("plan")}
          onToggle={() => sections.toggle("plan")}
        >
          <p className="mb-4 text-sm text-white/50">
            Demo runs for days, subscription for months. When it ends, the company can no longer sign in.
          </p>
          <PlanPicker value={form.plan} onChange={(plan) => setForm({ ...form, plan })} />
          <p className="mt-3 text-xs text-white/55">
            {option.label} for {form.plan.duration} {option.unit}, starting today. No features are on
            yet: after saving, tick them (or Select all) on the company page.
          </p>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="First Super Admin"
          subtitle={form.adminEmail || "Optional"}
          open={sections.isOpen("admin")}
          onToggle={() => sections.toggle("admin")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileField label="Name">
              <input
                className={fieldClass}
                value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              />
            </ProfileField>
            <ProfileField label="Email" hint="(password is emailed here)">
              <input
                className={fieldClass}
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </ProfileField>
          </div>
        </CollapsiblePanel>

        <div className="flex gap-2">
          <button type="submit" className={primaryBtn} disabled={saving}>
            {saving ? "Creating..." : "Create company"}
          </button>
          <Link to="/platform" className={ghostBtn}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
