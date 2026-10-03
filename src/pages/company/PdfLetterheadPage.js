import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import { isModuleEnabled } from "../../constants/nav";
import { hasPrivilege } from "../../constants/privileges";
import { api } from "../../services/api";

const EMPTY = {
  address: "",
  email: "",
  phone: "",
  mobile: "",
  website: "",
  fax: "",
  poBox: "",
  crNumber: "",
  vatNumber: "",
  logoData: "",
};

const TEXT_FIELDS = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "fax", label: "Fax" },
  { key: "website", label: "Website" },
  { key: "poBox", label: "P.O. Box" },
  { key: "crNumber", label: "Commercial registration" },
  { key: "vatNumber", label: "VAT number" },
];

export default function PdfLetterheadPage() {
  const roleKey = useSelector((state) => state.auth.role?.key);
  const privileges = useSelector((state) => state.auth.privileges);
  const features = useSelector((state) => state.auth.features);
  const catalog = useSelector((state) => state.auth.permissionCatalog);
  const company = useSelector((state) => state.auth.company);
  const featureOn = isModuleEnabled("company_settings", features, catalog);
  const canView = featureOn && (roleKey === "super_admin" || hasPrivilege(privileges, "company_settings", "view"));
  const canEdit = featureOn && (roleKey === "super_admin" || hasPrivilege(privileges, "company_settings", "edit"));
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canView) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/company/letterhead");
        if (cancelled) return;
        const saved = data.letterhead || {};
        setForm((current) => {
          if (current) return current;
          return {
            ...EMPTY,
            ...saved,
            address: saved.address || company?.address || "",
            email: saved.email || company?.email || "",
            phone: saved.phone || company?.phone || "",
            vatNumber: saved.vatNumber || company?.taxNumber || "",
            logoData: saved.logoData || "",
          };
        });
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load the PDF letterhead");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, company]);

  if (!canView) return <Navigate to="/" replace />;

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const onLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Logo must be a PNG or JPEG image");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Logo must be smaller than 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setField("logoData", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const onSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await api.put("/company/letterhead", form);
      setForm({ ...EMPTY, ...(data.letterhead || form) });
      setMessage("PDF letterhead saved. New material request PDFs will use these details.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro kicker="Documents" title="PDF letterhead">
        <p className="mt-1 text-sm text-white/55">Logo and contact details printed on the material request form.</p>
      </PageIntro>
      <GlassPanel as="article" className="p-5 sm:p-6">
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mb-3 text-sm font-medium text-brand-teal">{message}</p> : null}
        {!form ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm text-white/70">Logo</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                  {form.logoData ? (
                    <img src={form.logoData} alt="Company logo" className="max-h-14 max-w-[9rem] object-contain" />
                  ) : (
                    <span className="text-xs text-white/45">No logo yet</span>
                  )}
                </div>
                {canEdit ? (
                  <>
                    <label className={`${ghostBtn} cursor-pointer`}>
                      Upload logo
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
                    </label>
                    {form.logoData ? (
                      <button type="button" className={ghostBtn} onClick={() => setField("logoData", "")}>
                        Remove
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-white/45">PNG or JPEG, up to 500 KB. Shown at the top of the PDF.</p>
            </div>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-white/70">Address</span>
              <textarea
                className={`${fieldClass} min-h-[6rem]`}
                value={form.address}
                disabled={!canEdit}
                onChange={(e) => setField("address", e.target.value)}
                placeholder={"Street\nDistrict\nCity, country"}
              />
            </label>

            {TEXT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-sm text-white/70">{field.label}</span>
                <input
                  className={fieldClass}
                  value={form[field.key] || ""}
                  disabled={!canEdit}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              </label>
            ))}

            {canEdit ? (
              <div className="sm:col-span-2">
                <button type="submit" className={primaryBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save letterhead"}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </GlassPanel>
    </div>
  );
}
