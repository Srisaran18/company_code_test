import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { hasPrivilege } from "../../constants/privileges";
import { api } from "../../services/api";
import { syncCurrentUser } from "../../store/authSlice";
import { setDirectory } from "../../store/directorySlice";
import { userCreateHref, userEditHref } from "./userRoutes";
import DataTable from "../../components/ui/DataTable";
import GlassPanel from "../../components/ui/GlassPanel";
import { primaryBtn } from "../../components/ui/formStyles";

export default function UserManager({
  title = "Users",
  privilegeKey = "users",
  roleKeys,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryRole = params.get("role");
  const users = useSelector((state) => state.directory.users);
  const roles = useSelector((state) => state.directory.roles);
  const departments = useSelector((state) => state.directory.departments);
  const currentUser = useSelector((state) => state.auth.user);
  const privileges = useSelector((state) => state.auth.privileges);
  const canCreate = hasPrivilege(privileges, privilegeKey, "create");
  const canEdit = hasPrivilege(privileges, privilegeKey, "edit");
  const filterRoles = roleKeys || (queryRole ? [queryRole] : null);
  const list = filterRoles
    ? users.filter((user) => filterRoles.includes(user.role))
    : users;
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/users");
        if (!cancelled) dispatch(setDirectory({ users: data.users || [] }));
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const reload = async () => {
    const data = await api.get("/users");
    dispatch(setDirectory({ users: data.users || [] }));
    await dispatch(syncCurrentUser());
  };

  const data = useMemo(
    () =>
      list.map((user) => ({
        ...user,
        roleName: roles.find((item) => item.key === user.role)?.name || user.role,
        departmentName:
          departments.find((item) => item.key === user.department)?.name ||
          user.department ||
          "—",
        statusLabel: user.active === false ? "Inactive" : "Active",
      })),
    [list, roles, departments]
  );

  const toggleActive = async (user) => {
    if (!canEdit) return;
    if (currentUser?.id === user.id) {
      setError("You cannot deactivate your own account");
      return;
    }
    if (user.role === "super_admin") {
      setError("Cannot deactivate super admin");
      return;
    }
    setError("");
    setBusyId(user.id);
    try {
      await api.put(`/users/${user.id}`, { active: user.active === false });
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  };

  const columns = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "roleName", header: "Role" },
      { accessorKey: "departmentName", header: "Department" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = currentUser?.id === user.id;
          const isSuper = user.role === "super_admin";
          const active = user.active !== false;
          const disabled = !canEdit || isSelf || isSuper || busyId === user.id;
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                toggleActive(user);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40"
                  : "bg-red-500/20 text-red-100 ring-1 ring-red-400/40"
              } ${disabled ? "cursor-default opacity-80" : "hover:brightness-110"}`}
              title={
                isSuper
                  ? "Super admin stays active"
                  : isSelf
                    ? "Cannot change your own status"
                    : active
                      ? "Click to deactivate"
                      : "Click to activate"
              }
            >
              {busyId === user.id ? "…" : active ? "Active" : "Inactive"}
            </button>
          );
        },
      },
    ],
    // toggleActive closes over latest state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId, canEdit, currentUser?.id, users]
  );

  return (
    <GlassPanel as="article" className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-white/50">{list.length} records from the server</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() => navigate(userCreateHref(queryRole || undefined))}
          >
            Add user
          </button>
        ) : null}
      </div>

      {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search users"
        onRowClick={(record) => canEdit && navigate(userEditHref(record.id))}
      />
    </GlassPanel>
  );
}
