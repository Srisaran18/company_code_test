import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { api } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";

const emptyCreate = {
  code: "",
  name: "",
  timezone: "Asia/Riyadh",
  currency: "SAR",
  country: "",
  adminName: "",
  adminEmail: "",
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

export default function PlatformCompaniesPage() {
  const isPlatformAdmin = useSelector((state) => state.auth.user?.isPlatformAdmin === true);
  const [companies, setCompanies] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [createForm, setCreateForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const [features, setFeatures] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [companyData, featureData] = await Promise.all([
        api.get("/platform/companies"),
        api.get("/platform/features"),
      ]);
      setCompanies(companyData.companies || []);
      setCatalog(featureData.features || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin, load]);

  const openCompany = useCallback(async (id) => {
    setError("");
    setMessage("");
    try {
      const data = await api.get(`/platform/companies/${id}`);
      setSelected(data.company);
      setFeatures(data.features || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const columns = useMemo(
    () => [
      { accessorKey: "code", header: "Code" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "users", header: "Users" },
      { accessorKey: "status", header: "Status" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button type="button" className={ghostBtn} onClick={() => openCompany(row.original.id)}>
            Manage
          </button>
        ),
      },
    ],
    [openCompany]
  );

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  const createCompany = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const data = await api.post("/platform/companies", {
        code: createForm.code,
        name: createForm.name,
        timezone: createForm.timezone,
        currency: createForm.currency.toUpperCase(),
        country: createForm.country,
        features: catalog.filter((item) => item.alwaysOn).map((item) => item.key),
        admin: createForm.adminEmail ? { email: createForm.adminEmail, name: createForm.adminName } : undefined,
      });
      setCreateForm(null);
      setMessage(
        data.adminPassword
          ? `Company created. Admin password (shown once): ${data.adminPassword}`
          : "Company created."
      );
      await load();
      setSelected(data.company);
      setFeatures(data.features || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    setError("");
    try {
      const data = await api.put(`/platform/companies/${selected.id}`, { status });
      setSelected(data.company);
      setMessage(`Company is now ${status}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateFeature = (key, patch) =>
    setFeatures((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const saveFeatures = async () => {
    setError("");
    setSaving(true);
    try {
      const data = await api.put(`/platform/companies/${selected.id}/features`, {
        features: features.map((item) => ({
          key: item.key,
          enabled: item.enabled,
          startDate: item.startDate || null,
          endDate: item.endDate || null,
        })),
      });
      setFeatures(data.features || []);
      setMessage("Features saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro kicker="Platform" title="Companies" />
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-brand-teal">{message}</p> : null}

      <GlassPanel as="article" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Tenants</h2>
            <p className="text-sm text-white/50">{companies.length} companies</p>
          </div>
          <button type="button" className={primaryBtn} onClick={() => setCreateForm({ ...emptyCreate })}>
            Add company
          </button>
        </div>
        <DataTable columns={columns} data={companies} searchPlaceholder="Search companies" />

        {createForm ? (
          <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={createCompany}>
            {[
              ["code", "Code (e.g. ACME)", true],
              ["name", "Name", true],
              ["timezone", "Timezone", false],
              ["currency", "Currency", false],
              ["country", "Country", false],
              ["adminName", "First admin name", false],
              ["adminEmail", "First admin email", false],
            ].map(([key, label, required]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-sm text-white/70">{label}</span>
                <input
                  className={fieldClass}
                  type={key === "adminEmail" ? "email" : "text"}
                  value={createForm[key]}
                  required={required}
                  onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.value })}
                />
              </label>
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className={primaryBtn} disabled={saving}>
                {saving ? "Creating..." : "Create company"}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setCreateForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </GlassPanel>

      {selected ? (
        <GlassPanel as="article" className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {selected.name} ({selected.code})
              </h2>
              <p className="text-sm text-white/50">Status: {selected.status}</p>
            </div>
            <div className="flex gap-2">
              {selected.status === "active" ? (
                <button type="button" className={ghostBtn} onClick={() => setStatus("suspended")}>
                  Suspend
                </button>
              ) : (
                <button type="button" className={primaryBtn} onClick={() => setStatus("active")}>
                  Activate
                </button>
              )}
            </div>
          </div>

          <h3 className="text-base font-semibold">Features</h3>
          <div className="mt-3 space-y-2">
            {features.map((feature) => (
              <div key={feature.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                <label className="flex min-w-[14rem] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={feature.enabled}
                    disabled={feature.alwaysOn}
                    onChange={(e) => updateFeature(feature.key, { enabled: e.target.checked })}
                  />
                  {feature.name}
                  {feature.globalStatus === "inactive" ? " (globally off)" : ""}
                </label>
                {!feature.alwaysOn ? (
                  <>
                    <label className="flex items-center gap-2 text-xs text-white/60">
                      From
                      <input
                        type="date"
                        className={`${fieldClass} max-w-[10rem]`}
                        value={toDateInput(feature.startDate)}
                        onChange={(e) => updateFeature(feature.key, { startDate: e.target.value || null })}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-white/60">
                      Until
                      <input
                        type="date"
                        className={`${fieldClass} max-w-[10rem]`}
                        value={toDateInput(feature.endDate)}
                        onChange={(e) => updateFeature(feature.key, { endDate: e.target.value || null })}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" className={primaryBtn} disabled={saving} onClick={saveFeatures}>
              {saving ? "Saving..." : "Save features"}
            </button>
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}
