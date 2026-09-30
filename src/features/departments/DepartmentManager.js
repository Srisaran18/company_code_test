import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { refreshDirectory, syncCurrentUser } from "../../store/authSlice";
import { setDirectory } from "../../store/directorySlice";
import { menuGroups } from "../../constants/nav";
import { api } from "../../services/api";
import { cleanPrivilegesForCatalog, hasPrivilege } from "../../constants/privileges";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import GlassPanel from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import PrivilegeAccordion from "../privileges/PrivilegeAccordion";

const HIDDEN_MODULES = ["roles", "privileges", "departments", "projects", "audits", "company_settings"];

export default function DepartmentManager() {
  const dispatch = useDispatch();
  const departments = useSelector((state) => state.directory.departments);
  const projects = useSelector((state) => state.directory.projects);
  const actorRole = useSelector((state) => state.auth.role?.key);
  const privileges = useSelector((state) => state.auth.privileges);
  const catalog = useSelector((state) => state.auth.permissionCatalog);
  const canCreate = actorRole === "super_admin" || hasPrivilege(privileges, "departments", "create");
  const canEdit = actorRole === "super_admin" || hasPrivilege(privileges, "departments", "edit");
  const canDelete = actorRole === "super_admin" || hasPrivilege(privileges, "departments", "delete");
  const canChange = canCreate || canEdit;
  const [projectId, setProjectId] = useState("");
  const projectDepartments = useMemo(
    () => departments.filter((item) => !projectId || item.projectId === projectId),
    [departments, projectId]
  );
  const [selectedId, setSelectedId] = useState("");
  const selected = projectDepartments.find((item) => item.id === selectedId) || projectDepartments[0];
  const [draft, setDraft] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dispatch(refreshDirectory());
    (async () => {
      try {
        const [departmentData, projectData] = await Promise.all([api.get("/departments"), api.get("/projects")]);
        if (cancelled) return;
        dispatch(
          setDirectory({
            departments: departmentData.departments || [],
            projects: projectData.projects || [],
          })
        );
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load departments");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projectId, projects]);

  useEffect(() => {
    setDraft(null);
    setMessage("");
  }, [selected?.id]);

  const current = useMemo(
    () => draft || selected?.privileges || { dashboard: ["view"] },
    [draft, selected]
  );

  const enabledCount = useMemo(
    () =>
      Object.entries(current).reduce((sum, [key, actions]) => {
        if (HIDDEN_MODULES.includes(key)) return sum;
        return sum + (actions?.length || 0);
      }, 0),
    [current]
  );

  const createDepartment = async () => {
    if (!canCreate || !newName.trim() || !projectId) return;
    setError("");
    setSaving(true);
    try {
      const response = await api.post("/departments", {
        name: newName.trim(),
        projectId,
        privileges: { dashboard: ["view"], users: ["view", "create", "edit"] },
      });
      await dispatch(refreshDirectory());
      setAddOpen(false);
      setNewName("");
      setSelectedId(response.department?.id || "");
      setMessage("Saved changes successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!canChange || !selected) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api.put(`/departments/${selected.id}`, {
        name: selected.name,
        key: selected.key,
        privileges: cleanPrivilegesForCatalog(current, catalog),
      });
      await dispatch(refreshDirectory());
      await dispatch(syncCurrentUser());
      setMessage("Saved changes successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <GlassPanel as="aside" className="h-fit p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Departments
            </p>
            <h2 className="mt-1 text-lg font-semibold">Pick a department</h2>
          </div>
          {canCreate && projectId ? (
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                setAddOpen(true);
                setError("");
                setNewName("");
              }}
            >
              Add
            </button>
          ) : null}
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm text-white/70">Project</span>
          <select
            className={fieldClass}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSelectedId("");
              setMessage("");
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm text-white/50">
          Admins in a department get the access you set here.
        </p>
        <div className="mt-4 space-y-2">
          {projectDepartments.map((item) => {
            const active = selected?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setMessage("");
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  active
                    ? "bg-brand-blue text-white shadow-[0_8px_20px_rgba(4,114,223,0.35)]"
                    : "bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                <span className="text-sm font-medium">{item.name}</span>
              </button>
            );
          })}
          {!projectDepartments.length ? (
            <p className="text-sm text-white/45">No departments in this project yet.</p>
          ) : null}
        </div>
      </GlassPanel>

      <GlassPanel as="article" className="p-5 sm:p-6">
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mb-3 text-sm font-medium text-brand-teal">{message}</p> : null}

        <div className="mb-6 border-b border-white/10 pb-5">
          <p className="mb-1.5 text-sm text-white/70">Department</p>
          <p className="inline-flex rounded-2xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(4,114,223,0.28)]">
            {selected?.name || "Select a department"}
          </p>
        </div>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Access permissions</h3>
            <p className="mt-1 text-sm text-white/50">
              Open a section, then a page, and turn actions on or off.
            </p>
          </div>
          <p className="rounded-full bg-[#e8eef4] px-3 py-1 text-xs font-semibold text-[#334155]">
            {enabledCount} enabled
          </p>
        </div>

        <PrivilegeAccordion
          groups={menuGroups}
          current={current}
          canChange={canChange}
          onChange={(next) => {
            setDraft(next);
            setMessage("");
          }}
          filterModules={(key) => !HIDDEN_MODULES.includes(key)}
        />

        <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-5">
          {canDelete && selected ? (
            <button type="button" className={ghostBtn} onClick={() => setPendingDelete(selected)}>
              Delete
            </button>
          ) : null}
          {canChange && selected ? (
            <button type="button" className={primaryBtn} disabled={saving} onClick={save}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          ) : null}
        </div>
      </GlassPanel>

      {addOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-brand-navy/55 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
            aria-label="Close"
          />
          <GlassPanel className="relative z-10 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold">Add department</h2>
            <p className="mt-2 text-sm text-white/65">
              Create a department in {projects.find((item) => item.id === projectId)?.name || "this project"}, then
              set its admin access on this page.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm text-white/70">Department name</span>
              <input
                className={fieldClass}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Finance"
                autoFocus
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={ghostBtn} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={primaryBtn}
                disabled={saving || !newName.trim()}
                onClick={createDepartment}
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </GlassPanel>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete department"
        message={`Delete ${pendingDelete?.name}? Users in this department must be moved first.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          try {
            await api.del(`/departments/${pendingDelete.id}`);
            await dispatch(refreshDirectory());
            setPendingDelete(null);
            setSelectedId("");
            setMessage("Saved changes successfully.");
          } catch (err) {
            setError(err.message);
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
