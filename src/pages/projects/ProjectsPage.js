import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { hasPrivilege } from "../../constants/privileges";
import { refreshDirectory } from "../../store/authSlice";
import { setDirectory } from "../../store/directorySlice";
import { api } from "../../services/api";
import ActionMenu from "../../components/ui/ActionMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import DataTable from "../../components/ui/DataTable";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import { codeFromName } from "../../utils/codes";

export default function ProjectsPage() {
  const dispatch = useDispatch();
  const roleKey = useSelector((state) => state.auth.role?.key);
  const privileges = useSelector((state) => state.auth.privileges);
  const departments = useSelector((state) => state.directory.departments);
  const isSuperAdmin = roleKey === "super_admin";
  const canView = isSuperAdmin || hasPrivilege(privileges, "projects", "view");
  const canCreate = isSuperAdmin || hasPrivilege(privileges, "projects", "create");
  const canEdit = isSuperAdmin || hasPrivilege(privileges, "projects", "edit");
  const canDelete = isSuperAdmin || hasPrivilege(privileges, "projects", "delete");
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(null);
  const [codeLocked, setCodeLocked] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/projects");
      setProjects(data.projects || []);
      dispatch(setDirectory({ projects: data.projects || [] }));
    } catch (err) {
      setError(err.message);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!canView) return;
    load();
    dispatch(refreshDirectory());
  }, [canView, dispatch, load]);

  const onSave = async (event) => {
    event.preventDefault();
    setError("");
    const payload = { name: form.name, code: form.code, status: form.status };
    try {
      if (form.id) await api.put(`/projects/${form.id}`, payload);
      else await api.post("/projects", payload);
      setForm(null);
      setCodeLocked(false);
      await load();
      await dispatch(refreshDirectory());
    } catch (err) {
      setError(err.message);
    }
  };

  const data = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        departmentCount: departments.filter((item) => item.projectId === project.id).length,
      })),
    [departments, projects]
  );

  const columns = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "code", header: "Code" },
      { accessorKey: "departmentCount", header: "Departments" },
      { accessorKey: "status", header: "Status" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const project = row.original;
          return (
            <ActionMenu
              items={[
                canEdit
                  ? {
                      label: "Edit",
                      tone: "edit",
                      onClick: () => {
                        setCodeLocked(true);
                        setForm({ id: project.id, name: project.name, code: project.code, status: project.status });
                      },
                    }
                  : null,
                canDelete ? { label: "Delete", tone: "delete", onClick: () => setPendingDelete(project) } : null,
              ]}
            />
          );
        },
      },
    ],
    [canDelete, canEdit]
  );

  if (!canView) return <Navigate to="/" replace />;

  return (
    <div className="space-y-5">
      <PageIntro kicker="Organization" title="Projects" />
      <GlassPanel as="article" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Projects</h2>
            <p className="text-sm text-white/50">{projects.length} projects</p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                setError("");
                setCodeLocked(false);
                setForm({ name: "", code: "", status: "active" });
              }}
            >
              Add project
            </button>
          ) : null}
        </div>

        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        <DataTable columns={columns} data={data} searchPlaceholder="Search projects" />

        {form ? (
          <form className="mt-5 grid gap-3 sm:grid-cols-3" onSubmit={onSave}>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Name</span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    code: form.id || codeLocked ? form.code : codeFromName(e.target.value, "PRJ"),
                  })
                }
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Code (default from name)</span>
              <input
                className={fieldClass}
                value={form.code}
                placeholder="Auto from name"
                onChange={(e) => {
                  const code = e.target.value.toUpperCase();
                  setCodeLocked(Boolean(code));
                  setForm({ ...form, code });
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Status</span>
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" className={primaryBtn}>
                Save
              </button>
              <button type="button" className={ghostBtn} onClick={() => { setForm(null); setCodeLocked(false); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </GlassPanel>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete project"
        message={`Delete ${pendingDelete?.name}? Projects that still have departments, materials or requests cannot be deleted.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          try {
            await api.del(`/projects/${pendingDelete.id}`);
            await load();
            await dispatch(refreshDirectory());
          } catch (err) {
            setError(err.message);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
