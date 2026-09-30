import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, Navigate } from "react-router-dom";
import { api } from "../../services/api";
import { DonutChart, OverviewBarChart, OverviewLineChart } from "../../components/charts/Charts";
import DataTable from "../../components/ui/DataTable";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { ghostBtn } from "../../components/ui/formStyles";
import { formatDateLabel, formatTimeLabel, greetingForNow } from "../../utils/greeting";

const empty = {
  kpis: {},
  usageByDay: [],
  companiesByPlan: [],
  activityByCompany: [],
  onlineUsers: [],
  expiringSoon: [],
};

function Kpi({ label, value, hint, to }) {
  const inner = (
    <GlassPanel as="article" className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value ?? 0}</p>
      {hint ? <p className="mt-1 text-xs text-white/50">{hint}</p> : null}
    </GlassPanel>
  );
  return to ? (
    <Link to={to} className="block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function PlatformDashboardPage() {
  const isPlatformAdmin = useSelector((state) => state.auth.user?.isPlatformAdmin === true);
  const firstName = useSelector((state) => state.auth.user?.name?.split(" ")[0] || "there");
  const [data, setData] = useState(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const load = async () => {
    setError("");
    try {
      const next = await api.get("/platform/dashboard");
      setData(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPlatformAdmin) return undefined;
    load();
    const poll = setInterval(load, 30000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [isPlatformAdmin]);

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  const kpis = data.kpis || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageIntro kicker="Platform" title={`${greetingForNow(now)}, ${firstName}`}>
          <p className="mt-1 text-sm text-white/55">
            {formatDateLabel(now)} · {formatTimeLabel(now)} · Live users and company usage.
          </p>
        </PageIntro>
        <button type="button" className={ghostBtn} onClick={load}>
          Refresh
        </button>
      </div>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      {loading && !data.kpis?.companiesTotal ? (
        <p className="text-sm text-white/55">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Users online now" value={kpis.usersOnline} hint="Signed in within the last 5 minutes" />
            <Kpi label="Users active today" value={kpis.usersActiveToday} hint={`${kpis.usersTotal || 0} company users in total`} />
            <Kpi
              label="Companies used today"
              value={kpis.companiesUsedToday}
              hint={`${kpis.companiesActive || 0} active of ${kpis.companiesTotal || 0}`}
              to="/platform"
            />
            <Kpi
              label="Platform admins online"
              value={kpis.platformAdminsOnline}
              hint={`${kpis.companiesDemo || 0} demo · ${kpis.companiesSubscription || 0} subscription`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel as="article" className="p-5">
              <h2 className="text-lg font-semibold">Usage last 14 days</h2>
              <p className="mb-2 text-xs text-white/50">Logins, actions, and companies that were used.</p>
              <OverviewLineChart data={data.usageByDay || []} />
            </GlassPanel>
            <GlassPanel as="article" className="p-5">
              <h2 className="text-lg font-semibold">Companies by plan</h2>
              <p className="mb-2 text-xs text-white/50">
                {kpis.companiesExpired ? `${kpis.companiesExpired} expired · ` : ""}
                {kpis.companiesSuspended ? `${kpis.companiesSuspended} suspended` : "Live mix"}
              </p>
              {(data.companiesByPlan || []).length ? (
                <DonutChart data={data.companiesByPlan} />
              ) : (
                <p className="text-sm text-white/50">No companies yet.</p>
              )}
            </GlassPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel as="article" className="p-5">
              <h2 className="text-lg font-semibold">Activity today by company</h2>
              {(data.activityByCompany || []).length ? (
                <OverviewBarChart data={data.activityByCompany} />
              ) : (
                <p className="mt-6 text-sm text-white/50">No company activity yet today.</p>
              )}
            </GlassPanel>
            <GlassPanel as="article" className="p-5">
              <h2 className="text-lg font-semibold">Online now</h2>
              {(data.onlineUsers || []).length ? (
                <DataTable
                  columns={[
                    { accessorKey: "name", header: "Name" },
                    { accessorKey: "company", header: "Company" },
                    { accessorKey: "role", header: "Role" },
                    { accessorKey: "email", header: "Email" },
                  ]}
                  data={data.onlineUsers}
                  searchPlaceholder="Filter online"
                  pageSize={6}
                />
              ) : (
                <p className="mt-6 text-sm text-white/50">Nobody is online right now.</p>
              )}
            </GlassPanel>
          </div>

          <GlassPanel as="article" className="p-5">
            <h2 className="text-lg font-semibold">Plans ending within 7 days</h2>
            {(data.expiringSoon || []).length ? (
              <DataTable
                columns={[
                  { accessorKey: "code", header: "Code" },
                  { accessorKey: "name", header: "Company" },
                  { accessorKey: "plan", header: "Plan" },
                  { accessorKey: "daysLeft", header: "Days left" },
                ]}
                data={data.expiringSoon}
                searchPlaceholder="Filter plans"
                pageSize={8}
              />
            ) : (
              <p className="mt-2 text-sm text-white/50">No plans are ending this week.</p>
            )}
          </GlassPanel>
        </>
      )}
    </div>
  );
}
