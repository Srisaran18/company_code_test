import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import ProcessTracker from "../../features/workflow/ProcessTracker";
import StatusBadge from "../../components/ui/StatusBadge";
import { priorityLabel } from "../../constants/priority";
import { approveBtn, fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import {
  deleteMaterialRequest,
  saveMaterialRequest,
} from "../../store/workflowSlice";
import { hasPrivilege } from "../../constants/privileges";
import { downloadMaterialRequestPdf } from "../../features/workflow/materialRequestPdf";
import { actionClass, actionsFor, isEditableStatus } from "../../features/workflow/workflow";
import { api } from "../../services/api";

const fields = [
  { key: "id", label: "MR No." },
  { key: "project", label: "Project" },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "region", label: "Region" },
  { key: "city", label: "City" },
  { key: "priority", label: "Priority" },
  { key: "createdBy", label: "Created by" },
  { key: "assignedTo", label: "Assigned manager" },
  { key: "quantity", label: "Quantity" },
  { key: "justification", label: "Justification" },
  { key: "amount", label: "Amount" },
  { key: "supplier", label: "Supplier" },
  { key: "date", label: "Date" },
];

function linePending(item) {
  if (item?.pendingQty !== undefined && item?.pendingQty !== null && item?.pendingQty !== "") {
    return Number(item.pendingQty) || 0;
  }
  const requested = Number(String(item?.quantity || "").match(/\d+(?:\.\d+)?/)?.[0] || 0);
  return Math.max(0, requested - (Number(item?.issuedQty) || 0));
}

const modules = [
  "material_requests",
  "approvals",
  "procurement",
  "purchase_orders",
  "deliveries",
  "payments",
];

export default function MaterialRequestDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const privileges = useSelector((state) => state.auth.privileges);
  const roleKey = useSelector((state) => state.auth.role?.key || state.auth.user?.role);
  const currentUser = useSelector((state) => state.auth.user);
  const record = useSelector((state) =>
    state.workflow.materialRequests.find((item) => item.id === id)
  );
  const departments = useSelector((state) => state.directory.departments);
  const canView = modules.some((key) => hasPrivilege(privileges, key, "view"));
  const canEdit = modules.some((key) => hasPrivilege(privileges, key, "edit"));
  const canDelete = modules.some((key) => hasPrivilege(privileges, key, "delete"));
  const [pending, setPending] = useState(null);
  const [quotationText, setQuotationText] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(!record);
  const [error, setError] = useState("");
  const [issueQty, setIssueQty] = useState({});
  const [issueErrors, setIssueErrors] = useState({});
  const [storeNotice, setStoreNotice] = useState("");
  const [stockByProduct, setStockByProduct] = useState({});
  const [storeBusy, setStoreBusy] = useState(false);
  const features = useSelector((state) => state.auth.features);
  const canManageStore =
    (roleKey === "store" || roleKey === "super_admin") &&
    Boolean(record?.storeOpen) &&
    record?.status !== "Closed" &&
    record?.status !== "Rejected";
  const fulfillmentKey = (record?.products || [])
    .map((item) => `${item.productId}:${item.issuedQty}:${item.pendingQty}`)
    .join("|");

  useEffect(() => {
    if (!canManageStore) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/materials");
        if (cancelled) return;
        const stocks = {};
        (response.materials || []).forEach((item) => {
          stocks[item.productId] = Number(item.stock) || 0;
        });
        setStockByProduct(stocks);
        setIssueQty((current) => {
          const next = { ...current };
          (record?.products || []).forEach((item) => {
            if (next[item.productId] === undefined || next[item.productId] === "") {
              const pending = linePending(item);
              const available = Math.min(stocks[item.productId] || 0, pending);
              next[item.productId] = available > 0 ? String(available) : "";
            }
          });
          return next;
        });
      } catch {
        if (!cancelled) setStockByProduct({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageStore, record?.id, fulfillmentKey, record?.products]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/material-requests/${id}`);
        if (cancelled) return;
        dispatch(saveMaterialRequest(response.materialRequest));
        setForbidden(false);
      } catch {
        if (!cancelled) setForbidden(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, id]);

  if (!canView) return <Navigate to="/" replace />;
  if (
    forbidden ||
    ((roleKey === "user" || roleKey === "requestor" || roleKey === "requester") &&
      record &&
      record.requestedById &&
      record.requestedById !== currentUser?.id &&
      record.createdById !== currentUser?.id)
  ) {
    return <Navigate to="/material-requests" replace />;
  }
  if (loading && !record) {
    return (
      <div className="space-y-5">
        <PageIntro kicker="Request" title="Material request" />
        <GlassPanel className="p-6">
          <p className="text-sm text-white/65">Loading request…</p>
        </GlassPanel>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="space-y-5">
        <PageIntro kicker="Request" title="Material request" />
        <GlassPanel className="p-6">
          <p className="text-sm text-white/65">No requirement found for {id}.</p>
          <Link to="/material-requests" className={`${ghostBtn} mt-4 inline-block`}>
            Back to list
          </Link>
        </GlassPanel>
      </div>
    );
  }

  const actions = actionsFor(roleKey, record.status);
  const needsQuote = Boolean(pending?.action?.requiresQuotation);

  return (
    <div className="space-y-5">
      <div>
        <Link to="/material-requests" className={`${ghostBtn} mb-3`}>
          Back to list
        </Link>
        <p className="text-sm font-medium text-brand-teal">Requirement detail</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{record.id}</h1>
          <button
            type="button"
            className={primaryBtn}
            onClick={() =>
              downloadMaterialRequestPdf({
                record,
                departmentName:
                  departments.find((item) => item.key === record.department)?.name ||
                  record.department ||
                  "—",
              }).catch((err) => setError(err.message || "Could not create PDF"))
            }
          >
            Download PDF
          </button>
        </div>
      </div>

      <GlassPanel className="p-6">
        <ProcessTracker status={record.status} />
      </GlassPanel>

      <GlassPanel className="p-6">
        {error ? <p className="mb-4 text-sm text-red-200">{error}</p> : null}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={record.status} />
            <StatusBadge value={priorityLabel(record.priority || "P3")} />
            <StatusBadge value={record.paymentStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && isEditableStatus(record.status) ? (
              <button
                type="button"
                className={actionClass.edit}
                onClick={() => navigate(`/material-requests/${record.id}/edit`)}
              >
                Edit
              </button>
            ) : null}
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={actionClass[action.tone] || actionClass.edit}
                onClick={() => {
                  setQuotationText(record.quotation || "");
                  setPending({ action });
                }}
              >
                {action.label}
              </button>
            ))}
            {canDelete ? (
              <button
                type="button"
                className={actionClass.delete}
                onClick={() =>
                  setPending({ action: { label: "Delete", type: "delete", tone: "delete" } })
                }
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="rounded-2xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">{field.label}</p>
              <p className="mt-1 text-sm font-medium">
                {field.key === "amount"
                  ? Number(record.amount || 0).toLocaleString()
                  : field.key === "priority"
                    ? priorityLabel(record.priority || "P3")
                    : field.key === "department"
                    ? departments.find((item) => item.key === record.department)?.name ||
                      record.department ||
                      "—"
                    : record[field.key] || "—"}
              </p>
            </div>
          ))}
        </div>

        {record.quotation ? (
          <div className="mt-4 rounded-2xl bg-white/5 p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Quotation</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium">{record.quotation}</p>
          </div>
        ) : null}

        {record.products?.length ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  <th className="px-4 py-3">P. id</th>
                  <th className="px-4 py-3">Material name</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {record.products.map((item, index) => (
                  <tr key={`${item.productId || item.name}-${index}`} className="border-t border-white/8">
                    <td className="px-4 py-3">{item.productId || "—"}</td>
                    <td className="px-4 py-3">{item.name || "—"}</td>
                    <td className="px-4 py-3">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-4 py-3">{Number(item.issuedQty || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{linePending(item).toLocaleString()}</td>
                    <td className="px-4 py-3">{Number(item.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {record.storeOpen ? (
          <p className="mt-4 text-sm text-white/70">
            This request stays open until the Store has issued the full quantity.
            {record.purchaseSent
              ? " The shortage was sent to the purchase process. No purchase order is created automatically."
              : " A shortage is not sent to purchase unless the Store chooses to send it."}
          </p>
        ) : null}

        {canManageStore && record.products?.length ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Store issue</p>
            <p className="mt-1 text-xs text-white/55">
              Check stock, then issue what is available. Send only the shortage to purchase.
            </p>
            <div className="mt-4 hidden gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:grid sm:grid-cols-12">
              <span className="sm:col-span-5">Material</span>
              <span className="sm:col-span-3">Stock</span>
              <span className="sm:col-span-4">Qty to issue</span>
            </div>
            <div className="mt-3 space-y-3">
              {record.products.map((item) => {
                const pending = linePending(item);
                const stock = stockByProduct[item.productId] || 0;
                const available = stock > 0 && pending > 0;
                const fieldError = issueErrors[item.productId] || "";
                return (
                  <div key={item.productId || item.name} className="grid gap-2 sm:grid-cols-12 sm:items-start">
                    <div className="text-sm sm:col-span-5">
                      {item.productId} · {item.name}
                      <span className="mt-0.5 block text-xs text-white/50">Pending {pending.toLocaleString()}</span>
                    </div>
                    <div className="sm:col-span-3">
                      <p className={`text-sm font-medium ${available ? "text-emerald-300" : "text-red-200"}`}>
                        {available ? "Available" : "Not available"}
                      </p>
                      <p className="text-xs text-white/50">{stock.toLocaleString()} in stock</p>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        className={`${fieldClass} ${fieldError ? "field-invalid" : ""}`}
                        inputMode="decimal"
                        placeholder="Qty to issue"
                        aria-invalid={Boolean(fieldError)}
                        value={issueQty[item.productId] ?? ""}
                        disabled={pending <= 0 || storeBusy}
                        onChange={(event) => {
                          const productId = item.productId;
                          setIssueQty((current) => ({
                            ...current,
                            [productId]: event.target.value.replace(/[^\d.]/g, ""),
                          }));
                          setIssueErrors((current) => {
                            if (!current[productId]) return current;
                            const next = { ...current };
                            delete next[productId];
                            return next;
                          });
                        }}
                      />
                      {fieldError ? <p className="mt-1 text-xs text-red-200">{fieldError}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {storeNotice ? <p className="mt-3 text-sm text-red-200">{storeNotice}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={approveBtn}
                disabled={storeBusy}
                onClick={async () => {
                  const nextErrors = {};
                  const lines = [];
                  const pendingLines = (record.products || []).filter((item) => linePending(item) > 0);
                  const filled = pendingLines.filter((item) => String(issueQty[item.productId] ?? "").trim());
                  if (!filled.length) {
                    pendingLines.forEach((item) => {
                      nextErrors[item.productId] = "Enter a quantity to issue";
                    });
                  }
                  filled.forEach((item) => {
                    const pending = linePending(item);
                    const stock = stockByProduct[item.productId] || 0;
                    const quantity = Number(issueQty[item.productId]);
                    if (!quantity) {
                      nextErrors[item.productId] = "Enter a quantity to issue";
                      return;
                    }
                    if (quantity > stock) {
                      nextErrors[item.productId] =
                        stock > 0 ? `Only ${stock.toLocaleString()} in stock` : "Not available";
                      return;
                    }
                    if (quantity > pending) {
                      nextErrors[item.productId] = `Only ${pending.toLocaleString()} still pending`;
                      return;
                    }
                    lines.push({ productId: item.productId, quantity });
                  });
                  if (Object.keys(nextErrors).length || !lines.length) {
                    setIssueErrors(nextErrors);
                    setStoreNotice("");
                    return;
                  }
                  try {
                    setStoreBusy(true);
                    setIssueErrors({});
                    setStoreNotice("");
                    const response = await api.post(`/material-requests/${record.id}/issue`, { lines });
                    dispatch(saveMaterialRequest(response.materialRequest));
                    setIssueQty({});
                  } catch (err) {
                    const message = err.message || "Could not issue stock";
                    const matched = (record.products || []).find((item) => message.includes(item.productId));
                    if (matched) setIssueErrors({ [matched.productId]: message });
                    else setStoreNotice(message);
                  } finally {
                    setStoreBusy(false);
                  }
                }}
              >
                {storeBusy ? "Issuing..." : "Issue stock"}
              </button>
              {!record.purchaseSent &&
              (record.products || []).some((item) => linePending(item) > 0) &&
              features?.includes("procurement") ? (
                <button
                  type="button"
                  className={ghostBtn}
                  disabled={storeBusy}
                  onClick={async () => {
                    const blocked = {};
                    (record.products || []).forEach((item) => {
                      const pending = linePending(item);
                      const stock = stockByProduct[item.productId] || 0;
                      if (pending > 0 && stock > 0) {
                        blocked[item.productId] = "Issue the available stock before sending the rest to purchase";
                      }
                    });
                    if (Object.keys(blocked).length) {
                      setIssueErrors(blocked);
                      setStoreNotice("");
                      return;
                    }
                    try {
                      setStoreBusy(true);
                      setIssueErrors({});
                      setStoreNotice("");
                      const response = await api.post(
                        `/material-requests/${record.id}/send-to-purchase`,
                        {}
                      );
                      dispatch(saveMaterialRequest(response.materialRequest));
                    } catch (err) {
                      setStoreNotice(err.message || "Could not send the shortage to purchase");
                    } finally {
                      setStoreBusy(false);
                    }
                  }}
                >
                  Send pending to purchase
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </GlassPanel>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.action?.label || "Confirm"}
        message={
          pending?.action?.type === "delete"
            ? `Delete ${record.id}?`
            : needsQuote
              ? "Enter the supplier quotation in the box below (price, terms, notes)."
              : `Move ${record.id} to ${pending?.action?.status}?`
        }
        confirmLabel={pending?.action?.label || "Confirm"}
        danger={pending?.action?.tone === "reject" || pending?.action?.type === "delete"}
        onCancel={() => {
          setPending(null);
          setQuotationText("");
        }}
        onConfirm={async () => {
          try {
            setError("");
            if (pending.action.type === "delete") {
              await api.del(`/material-requests/${record.id}`);
              dispatch(deleteMaterialRequest(record.id));
              navigate("/material-requests");
            } else {
              if (needsQuote && !quotationText.trim()) {
                setError("Quotation text is required");
                return;
              }
              const payload = {};
              if (pending.action.status && pending.action.status !== record.status) {
                payload.status = pending.action.status;
              }
              if (needsQuote) payload.quotation = quotationText.trim();
              const response = await api.put(`/material-requests/${record.id}`, payload);
              dispatch(saveMaterialRequest(response.materialRequest));
            }
            setPending(null);
            setQuotationText("");
          } catch (err) {
            setError(err.message);
            setPending(null);
          }
        }}
      >
        {needsQuote ? (
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/70">Quotation</span>
            <textarea
              className={`${fieldClass} min-h-[7rem]`}
              value={quotationText}
              onChange={(e) => setQuotationText(e.target.value)}
              placeholder="e.g. Unit price 1200, delivery 7 days, warranty 1 year…"
              autoFocus
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
