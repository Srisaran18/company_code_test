import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import { planSummary } from "./planOptions";

function PlanBadge({ plan }) {
  const tone = !plan?.mode
    ? "border border-white/15 text-white/50"
    : plan.expired
      ? "bg-red-500/80 text-white"
      : plan.mode === "demo"
        ? "bg-amber-500/85 text-white"
        : "bg-brand-teal text-white";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{planSummary(plan)}</span>;
}

export default function PlatformCompaniesPage() {
  const navigate = useNavigate();
  const isPlatformAdmin = useSelector((state) => state.auth.user?.isPlatformAdmin === true);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/platform/companies");
      setCompanies(
        (data.companies || []).map((item) => ({
          ...item,
          planText: planSummary(item.plan),
        }))
      );
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin, load]);

  const openCompany = useCallback((id) => navigate(`/platform/${id}`), [navigate]);

  const columns = useMemo(
    () => [
      { accessorKey: "code", header: "Code" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "timezone", header: "Timezone" },
      {
        accessorKey: "planText",
        header: "Plan",
        cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
      },
      { accessorKey: "users", header: "Users" },
      { accessorKey: "status", header: "Status" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button type="button" className={ghostBtn} onClick={() => openCompany(row.original.id)}>
            Open details
          </button>
        ),
      },
    ],
    [openCompany]
  );

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-5">
      <PageIntro kicker="Platform" title="Companies">
        <p className="mt-1 text-sm text-white/55">
          Click a company to open its details page: plan, feature dates, Super Admin access, and that
          company’s audit report.
        </p>
      </PageIntro>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}

      <GlassPanel as="article" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Tenants</h2>
            <p className="text-sm text-white/50">{companies.length} companies</p>
          </div>
          <button type="button" className={primaryBtn} onClick={() => navigate("/platform/new")}>
            Add company
          </button>
        </div>
        <DataTable
          columns={columns}
          data={companies}
          searchPlaceholder="Search companies"
          onRowClick={(row) => openCompany(row.id)}
        />
      </GlassPanel>
    </div>
  );
}
