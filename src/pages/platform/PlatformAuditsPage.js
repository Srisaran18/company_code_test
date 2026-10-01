import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { api } from "../../services/api";
import DataTable from "../../components/ui/DataTable";
import AuditDetailDialog from "../../components/ui/AuditDetailDialog";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";

const columns = [
  { accessorKey: "date", header: "When" },
  { accessorKey: "company", header: "Company" },
  { accessorKey: "who", header: "Who" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "module", header: "Module" },
  { accessorKey: "summary", header: "Summary" },
  { accessorKey: "actorName", header: "Name" },
  { accessorKey: "actorEmail", header: "Email" },
  { accessorKey: "ip", header: "IP" },
];

const emptyFilters = {
  q: "",
  company: "all",
  actor: "all",
  module: "all",
  action: "all",
  range: "7",
};

function rangeDates(range) {
  if (range === "all") return { from: "", until: "" };
  const until = new Date();
  const from = new Date();
  if (range === "today") from.setHours(0, 0, 0, 0);
  else from.setDate(from.getDate() - Number(range || 7) + 1);
  return { from: from.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

function parseSmart(raw, companies) {
  const q = String(raw || "").trim();
  const lower = q.toLowerCase();
  const next = {};
  if (/^(platform(\s*admin)?s?|my(\s*actions)?)$/i.test(q)) {
    next.actor = "platform";
    next.q = "";
    return next;
  }
  const match = companies.find(
    (item) => item.name.toLowerCase() === lower || String(item.code).toLowerCase() === lower
  );
  if (match) {
    next.company = match.id;
    next.q = "";
    return next;
  }
  next.q = q;
  return next;
}

export default function PlatformAuditsPage() {
  const isPlatformAdmin = useSelector((state) => state.auth.user?.isPlatformAdmin === true);
  const [audits, setAudits] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [modules, setModules] = useState([]);
  const [actions, setActions] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [draft, setDraft] = useState(emptyFilters.q);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (nextFilters.q) params.set("q", nextFilters.q);
      if (nextFilters.company && nextFilters.company !== "all") params.set("company", nextFilters.company);
      if (nextFilters.actor && nextFilters.actor !== "all") params.set("actor", nextFilters.actor);
      if (nextFilters.module && nextFilters.module !== "all") params.set("module", nextFilters.module);
      if (nextFilters.action && nextFilters.action !== "all") params.set("action", nextFilters.action);
      const { from, until } = rangeDates(nextFilters.range);
      if (from) params.set("from", from);
      if (until) params.set("until", until);
      const data = await api.get(`/platform/audits?${params.toString()}`);
      setAudits(data.audits || []);
      if (data.companies) setCompanies(data.companies);
      if (data.modules) setModules(data.modules);
      if (data.actions) setActions(data.actions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformAdmin, filters.company, filters.actor, filters.module, filters.action, filters.range, filters.q]);

  const onSearch = (event) => {
    event.preventDefault();
    const smart = parseSmart(draft, companies);
    const next = { ...filters, q: draft, ...smart };
    setDraft(next.q);
    setFilters(next);
  };

  const clear = () => {
    setDraft("");
    setFilters(emptyFilters);
    load(emptyFilters);
  };

  const moduleOptions = useMemo(
    () => [...new Set(["auth", "platform", "users", ...modules])].filter(Boolean),
    [modules]
  );
  const actionOptions = useMemo(
    () => [...new Set(["login", "logout", "create", "update", ...actions])].filter(Boolean),
    [actions]
  );

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-[calc(100vh-6.5rem)] flex-col gap-4">
      <PageIntro kicker="Platform" title="Audit report">
        <p className="mt-1 text-sm text-white/55">
          Filter by company or platform admin. Click a row for the full record, including the IP
          it was accessed from. Smart search accepts a company name, a code, “platform”, or an IP.
        </p>
      </PageIntro>

      <GlassPanel className="flex min-h-0 flex-1 flex-col p-5">
        <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={onSearch}>
          <label className="block min-w-[16rem] flex-1">
            <span className="mb-1 block text-xs text-white/55">Smart search</span>
            <input
              className={fieldClass}
              value={draft}
              placeholder='Company, email, “platform”, or any text'
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/55">Company</span>
            <select
              className={`${fieldClass} min-w-[12rem]`}
              value={filters.company}
              onChange={(e) => setFilters({ ...filters, company: e.target.value })}
            >
              <option value="all">All companies</option>
              <option value="platform">Platform only</option>
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/55">Who</span>
            <select
              className={`${fieldClass} min-w-[10rem]`}
              value={filters.actor}
              onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
            >
              <option value="all">Everyone</option>
              <option value="platform">Platform admin</option>
              <option value="company">Company users</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/55">When</span>
            <select
              className={`${fieldClass} min-w-[9rem]`}
              value={filters.range}
              onChange={(e) => setFilters({ ...filters, range: e.target.value })}
            >
              <option value="today">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/55">Module</span>
            <select
              className={`${fieldClass} min-w-[9rem]`}
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
            >
              <option value="all">All</option>
              {moduleOptions.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/55">Action</span>
            <select
              className={`${fieldClass} min-w-[9rem]`}
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="all">All</option>
              {actionOptions.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={primaryBtn}>
            Search
          </button>
          <button type="button" className={ghostBtn} onClick={() => load(filters)}>
            Refresh
          </button>
          <button type="button" className={ghostBtn} onClick={clear}>
            Clear
          </button>
        </form>
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-white/55">Loading audits…</p>
        ) : (
          <DataTable
            columns={columns}
            data={audits}
            searchPlaceholder="Filter these results"
            pageSize={15}
            fillHeight
            onRowClick={setSelected}
          />
        )}
      </GlassPanel>
      <AuditDetailDialog audit={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
