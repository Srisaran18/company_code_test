import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { api } from "../../services/api";
import { PageIntro } from "../../components/ui/GlassPanel";
import PlatformCompanyWorkspace from "./PlatformCompanyWorkspace";
import { normalizeProfile, profilePayload } from "./CompanyProfileFields";
import { withPlanDates } from "./planOptions";

export default function PlatformCompanyDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const isPlatformAdmin = useSelector((state) => state.auth.user?.isPlatformAdmin === true);
  const [company, setCompany] = useState(null);
  const [features, setFeatures] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [audits, setAudits] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [saving, setSaving] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const showCompany = (company) => {
    setCompany(normalizeProfile(company));
  };

  const load = useCallback(async () => {
    const data = await api.get(`/platform/companies/${id}`);
    setCompany(normalizeProfile(data.company));
    setFeatures(withPlanDates(data.features || [], data.company.plan));
    setAdmins(data.admins || []);
  }, [id]);

  const loadAudits = useCallback(async () => {
    setLoadingAudits(true);
    try {
      const data = await api.get(`/platform/companies/${id}/audits?limit=500`);
      setAudits(data.audits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAudits(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isPlatformAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) await loadAudits();
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin, load, loadAudits]);

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  const setStatus = async (status) => {
    setError("");
    try {
      const data = await api.put(`/platform/companies/${id}`, { status });
      showCompany(data.company);
      setMessage(`Company is now ${status}.`);
      await loadAudits();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await api.put(`/platform/companies/${id}`, profilePayload(company));
      showCompany(data.company);
      setMessage("Company details saved.");
      await loadAudits();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePlan = async (plan) => {
    setError("");
    setSaving(true);
    try {
      const data = await api.put(`/platform/companies/${id}`, { plan });
      showCompany(data.company);
      setFeatures(data.features || []);
      setMessage("Plan updated. Feature dates now follow the plan.");
      await loadAudits();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveFeatures = async () => {
    setError("");
    setSaving(true);
    try {
      const data = await api.put(`/platform/companies/${id}/features`, {
        features: features.map((item) => ({
          key: item.key,
          enabled: item.enabled,
          startDate: item.startDate || null,
          endDate: item.endDate || null,
        })),
      });
      setFeatures(data.features || []);
      setMessage("Features saved.");
      await loadAudits();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro kicker="Platform" title={company ? `${company.name} (${company.code})` : "Company"}>
        <Link to="/platform" className="mt-2 inline-block text-sm text-brand-teal hover:underline">
          Back to companies
        </Link>
      </PageIntro>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-brand-teal">{message}</p> : null}

      {!company ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : (
        <PlatformCompanyWorkspace
          company={company}
          setCompany={setCompany}
          features={features}
          setFeatures={setFeatures}
          admins={admins}
          audits={audits}
          loadingAudits={loadingAudits}
          saving={saving}
          onSaveProfile={saveProfile}
          onSaveFeatures={saveFeatures}
          onSetStatus={setStatus}
          onSavePlan={savePlan}
          onRefreshAudits={loadAudits}
          lockEmail
        />
      )}
    </div>
  );
}
