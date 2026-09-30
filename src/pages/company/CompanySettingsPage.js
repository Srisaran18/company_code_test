import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { hasPrivilege } from "../../constants/privileges";
import { setCompany } from "../../store/authSlice";
import { api } from "../../services/api";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, primaryBtn } from "../../components/ui/formStyles";

const PROFILE_FIELDS = [
  { key: "name", label: "Company name", required: true },
  { key: "legalName", label: "Legal name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "country", label: "Country" },
  { key: "timezone", label: "Timezone (e.g. Asia/Riyadh)" },
  { key: "currency", label: "Currency (ISO code, e.g. SAR)" },
];

const PREFIX_FIELDS = [
  { key: "mrPrefix", label: "Material request prefix" },
  { key: "woPrefix", label: "Work order prefix" },
  { key: "poPrefix", label: "Purchase order prefix" },
];

export default function CompanySettingsPage() {
  const dispatch = useDispatch();
  const roleKey = useSelector((state) => state.auth.role?.key);
  const privileges = useSelector((state) => state.auth.privileges);
  const isSuperAdmin = roleKey === "super_admin";
  const canView = isSuperAdmin || hasPrivilege(privileges, "company_settings", "view");
  const canEdit = isSuperAdmin || hasPrivilege(privileges, "company_settings", "edit");
  const [form, setForm] = useState(null);
  const [features, setFeatures] = useState([]);
  const [dateFormats, setDateFormats] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/company");
        if (cancelled) return;
        setForm({ ...data.company, settings: { ...(data.company.settings || {}) } });
        setFeatures(data.features || []);
        setDateFormats(data.dateFormats || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  if (!canView) return <Navigate to="/" replace />;

  const setSetting = (key, value) => setForm({ ...form, settings: { ...form.settings, [key]: value } });

  const onSave = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, form[field.key] || ""]));
      payload.currency = String(payload.currency).toUpperCase();
      payload.settings = {
        dateFormat: form.settings.dateFormat,
        mrPrefix: form.settings.mrPrefix,
        woPrefix: form.settings.woPrefix,
        poPrefix: form.settings.poPrefix,
        numberPadding: Number(form.settings.numberPadding),
      };
      const data = await api.put("/company", payload);
      dispatch(setCompany(data.company));
      setMessage("Saved changes successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro kicker="Organization" title="Company settings" />
      <GlassPanel as="article" className="p-5">
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mb-3 text-sm font-medium text-brand-teal">{message}</p> : null}
        {!form ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSave}>
            <p className="text-sm text-white/50 sm:col-span-2">Company code: {form.code}</p>
            {PROFILE_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-sm text-white/70">{field.label}</span>
                <input
                  className={fieldClass}
                  value={form[field.key] || ""}
                  disabled={!canEdit}
                  required={field.required}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Date format</span>
              <select
                className={fieldClass}
                value={form.settings.dateFormat || ""}
                disabled={!canEdit}
                onChange={(e) => setSetting("dateFormat", e.target.value)}
              >
                {dateFormats.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>
            {PREFIX_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-sm text-white/70">{field.label}</span>
                <input
                  className={fieldClass}
                  value={form.settings[field.key] || ""}
                  disabled={!canEdit}
                  onChange={(e) => setSetting(field.key, e.target.value.toUpperCase())}
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Number padding (digits)</span>
              <input
                type="number"
                min={3}
                max={10}
                className={fieldClass}
                value={form.settings.numberPadding ?? 6}
                disabled={!canEdit}
                onChange={(e) => setSetting("numberPadding", e.target.value)}
              />
            </label>
            {canEdit ? (
              <div className="sm:col-span-2">
                <button type="submit" className={primaryBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </GlassPanel>

      <GlassPanel as="article" className="p-5">
        <h2 className="text-lg font-semibold">Subscribed features</h2>
        <p className="mt-1 text-sm text-white/50">Managed by your service provider.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {features.map((feature) => (
            <span
              key={feature.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                feature.enabled ? "bg-brand-blue text-white" : "border border-white/15 text-white/45"
              }`}
            >
              {feature.name}
              {feature.enabled ? "" : " (not enabled)"}
            </span>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
