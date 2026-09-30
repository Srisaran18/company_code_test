import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { api } from "../../services/api";
import { hasPrivilege } from "../../constants/privileges";
import ActionMenu from "../../components/ui/ActionMenu";
import DataTable from "../../components/ui/DataTable";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn } from "../../components/ui/formStyles";

export default function DeleteRequests() {
  const user = useSelector((state) => state.auth.user);
  const privileges = useSelector((state) => state.auth.privileges);
  const canView =
    hasPrivilege(privileges, "delete_requests", "view") ||
    user?.role === "super_admin" ||
    user?.role === "admin";
  const canReview = hasPrivilege(privileges, "delete_requests", "approve") || user?.role === "super_admin";
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/delete-requests");
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = useCallback(
    async (id, action) => {
      setError("");
      try {
        await api.post(`/delete-requests/${id}/review`, { action, note });
        setNote("");
        await load();
      } catch (err) {
        setError(err.message);
      }
    },
    [load, note]
  );

  const columns = useMemo(
    () => [
      {
        id: "targetName",
        header: "User",
        accessorFn: (row) => row.targetSnapshot?.name || "",
      },
      {
        id: "targetEmail",
        header: "Email",
        accessorFn: (row) => row.targetSnapshot?.email || "",
      },
      {
        id: "targetRole",
        header: "Role",
        accessorFn: (row) => row.targetSnapshot?.role || "",
      },
      {
        id: "requestedBy",
        header: "Requested by",
        accessorFn: (row) => row.requestedBy?.name || "",
      },
      { accessorKey: "reason", header: "Reason" },
      { accessorKey: "status", header: "Status" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          if (!canReview || item.status !== "pending") return "—";
          return (
            <ActionMenu
              items={[
                { label: "Approve", tone: "approve", onClick: () => review(item._id, "approve") },
                { label: "Reject", tone: "reject", onClick: () => review(item._id, "reject") },
              ]}
            />
          );
        },
      },
    ],
    [canReview, review]
  );

  if (!canView) return <Navigate to="/" replace />;

  return (
    <div className="space-y-5">
      <PageIntro kicker="Admin" title="Delete requests" />
      <GlassPanel as="article" className="p-5">
        <p className="mb-4 text-sm text-white/55">
          Admins without delete access send requests here. Super admin approves or rejects them.
        </p>
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        {canReview ? (
          <label className="mb-4 block max-w-md">
            <span className="mb-1.5 block text-sm text-white/70">Review note (optional)</span>
            <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        ) : null}
        <DataTable columns={columns} data={requests} searchPlaceholder="Search requests" />
        <button type="button" className={`${ghostBtn} mt-4`} onClick={load}>
          Refresh
        </button>
      </GlassPanel>
    </div>
  );
}
