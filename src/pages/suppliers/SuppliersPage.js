import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import ActionMenu from "../../components/ui/ActionMenu";
import DataTable from "../../components/ui/DataTable";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import StatusBadge from "../../components/ui/StatusBadge";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import { saveSupplier } from "../../store/workflowSlice";
import { hasPrivilege } from "../../constants/privileges";

export default function Suppliers() {
  const dispatch = useDispatch();
  const privileges = useSelector((state) => state.auth.privileges);
  const suppliers = useSelector((state) => state.workflow.suppliers);
  const canCreate = hasPrivilege(privileges, "suppliers", "create");
  const canEdit = hasPrivilege(privileges, "suppliers", "edit");
  const [form, setForm] = useState(null);

  const columns = useMemo(
    () => [
      { accessorKey: "name", header: "Supplier" },
      { accessorKey: "contact", header: "Contact" },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => <StatusBadge value={info.getValue()} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
            <ActionMenu
              items={
                canEdit
                  ? [{ label: "Edit", tone: "edit", onClick: () => setForm(row.original) }]
                  : []
              }
            />
          ),
      },
    ],
    [canEdit]
  );

  if (!hasPrivilege(privileges, "suppliers", "view")) return <Navigate to="/" replace />;

  return (
    <div className="space-y-5">
      <PageIntro kicker="Sourcing" title="Suppliers" />
      <GlassPanel className="p-5">
        <div className="mb-4 flex justify-end">
          {canCreate ? (
            <button
              type="button"
              className={primaryBtn}
              onClick={() => setForm({ name: "", contact: "", status: "Pending" })}
            >
              Add supplier
            </button>
          ) : null}
        </div>
        <DataTable columns={columns} data={suppliers} searchPlaceholder="Filter suppliers" />
        {form ? (
          <form
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              dispatch(
                saveSupplier({
                  ...form,
                  id: form.id || Math.max(0, ...suppliers.map((item) => item.id)) + 1,
                })
              );
              setForm(null);
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Name</span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Contact</span>
              <input
                className={fieldClass}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                required
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className={primaryBtn}>
                Save
              </button>
              <button type="button" className={ghostBtn} onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </GlassPanel>
    </div>
  );
}
