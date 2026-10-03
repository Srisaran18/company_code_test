import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { approveBtn, fieldClass, ghostBtn } from "../../components/ui/formStyles";
import SearchSelect from "../../components/ui/SearchSelect";
import { PRIORITIES } from "../../constants/priority";
import { hasPrivilege } from "../../constants/privileges";
import { api } from "../../services/api";
import { saveMaterialRequest } from "../../store/workflowSlice";
import { isEditableStatus } from "../../features/workflow/workflow";

const emptyProduct = () => ({
  productId: "",
  name: "",
  description: "",
  quantity: "",
  unit: "",
});

function ShakeBox({ active, shakeKey, className = "", children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const el = ref.current;
    el.classList.remove("field-shake");
    void el.offsetWidth;
    el.classList.add("field-shake");
    return undefined;
  }, [active, shakeKey]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function toFormProducts(products) {
  if (!products?.length) return [emptyProduct()];
  return products.map((item) => ({
    productId: item.productId || "",
    name: item.name || "",
    description: item.description || (!item.productId ? item.name : "") || "",
    quantity: item.quantity || "",
    unit: item.unit || "",
  }));
}

export default function MaterialRequestFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const privileges = useSelector((state) => state.auth.privileges);
  const currentUser = useSelector((state) => state.auth.user);
  const userDepartment = currentUser?.department || "";
  const existing = useSelector((state) =>
    state.workflow.materialRequests.find((item) => item.id === id)
  );
  const canCreate = hasPrivilege(privileges, "material_requests", "create");
  const canEdit = hasPrivilege(privileges, "material_requests", "edit");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [manager, setManager] = useState(null);
  const [form, setForm] = useState({
    projectId: "",
    departmentId: "",
    location: "",
    region: "",
    city: "",
    justification: "",
    priority: "P3",
    products: [emptyProduct()],
    status: "Draft",
  });

  useEffect(() => {
    (async () => {
      try {
        const [projectResponse, departmentResponse, materialResponse] = await Promise.all([
          api.get("/projects"),
          api.get("/departments"),
          api.get("/materials"),
        ]);
        setProjects((projectResponse.projects || []).filter((item) => item.status !== "inactive"));
        setDepartments(departmentResponse.departments || []);
        setMaterials(materialResponse.materials || []);
      } catch (err) {
        setError(err.message || "Failed to load projects, departments and materials");
      }
    })();
  }, []);

  useEffect(() => {
    if (!form.departmentId || !form.projectId) {
      setManager(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ projectId: form.projectId, departmentId: form.departmentId });
        const response = await api.get(`/material-requests/assignees?${params.toString()}`);
        if (cancelled) return;
        setManager(response.manager || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load the department manager");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.departmentId, form.projectId]);

  useEffect(() => {
    if (!isEdit) return;
    if (existing) {
      setForm({
        projectId: existing.projectId || "",
        departmentId: existing.departmentId || "",
        location: existing.location || "",
        region: existing.region || "",
        city: existing.city || "",
        justification: existing.justification || "",
        priority: existing.priority || "P3",
        status: existing.status || "Draft",
        products: toFormProducts(existing.products),
      });
      return;
    }
    (async () => {
      try {
        const response = await api.get("/material-requests");
        const match = (response.materialRequests || []).find((item) => item.id === id);
        if (!match) return;
        dispatch(saveMaterialRequest(match));
        setForm({
          projectId: match.projectId || "",
          departmentId: match.departmentId || "",
          location: match.location || "",
          region: match.region || "",
          city: match.city || "",
          justification: match.justification || "",
          priority: match.priority || "P3",
          status: match.status || "Draft",
          products: toFormProducts(match.products),
        });
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [dispatch, existing, id, isEdit]);

  if (isEdit && !canEdit) return <Navigate to="/material-requests" replace />;
  if (!isEdit && !canCreate) return <Navigate to="/material-requests" replace />;
  if (isEdit && existing && !isEditableStatus(existing.status)) {
    return <Navigate to={`/material-requests/${id}`} replace />;
  }

  const projectOptions = projects.map((item) => ({ value: item.id, label: item.name }));
  if (form.projectId && !projects.some((item) => item.id === form.projectId) && existing?.project) {
    projectOptions.unshift({ value: form.projectId, label: existing.project });
  }

  const departmentOptions = departments.filter((item) => item.projectId === form.projectId);

  const matchingMaterials = materials.filter(
    (item) => item.shared === true || (form.departmentId && item.departmentId === form.departmentId)
  );

  const defaultDepartmentFor = (projectId) =>
    departments.find((item) => item.projectId === projectId && item.key === userDepartment)?.id || "";

  const clearInvalid = (...keys) => {
    setInvalid((prev) => {
      if (!keys.some((key) => prev[key])) return prev;
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const updateProduct = (index, patch) => {
    clearInvalid(`product-${index}`, `qty-${index}`);
    setForm((prev) => {
      const products = [...prev.products];
      products[index] = { ...products[index], ...patch };
      return { ...prev, products };
    });
  };

  const chooseMaterial = (index, productId) => {
    clearInvalid(`product-${index}`);
    const material = matchingMaterials.find((item) => item.productId === productId);
    setForm((prev) => {
      const products = prev.products.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId: material?.productId || "",
              name: material?.name || "",
              unit: material?.unit || "",
            }
          : item
      );
      if (material && products.every((item) => item.productId)) {
        products.push(emptyProduct());
      }
      return { ...prev, products };
    });
  };

  const clearProductChoices = (products) =>
    products.map((item) => ({
      ...emptyProduct(),
      description: item.description,
      quantity: item.quantity,
    }));

  const onProjectChange = (projectId) => {
    clearInvalid("project");
    setForm((prev) => ({
      ...prev,
      projectId,
      departmentId: defaultDepartmentFor(projectId),
      products: clearProductChoices(prev.products),
    }));
  };

  const onDepartmentChange = (departmentId) => {
    clearInvalid("department");
    setForm((prev) => ({
      ...prev,
      departmentId,
      products: clearProductChoices(prev.products),
    }));
  };

  const saveRequest = async (status) => {
    setError("");
    const products = form.products
      .filter((item) => item.productId && item.quantity)
      .map((item) => ({
        productId: item.productId,
        name: item.name,
        description: item.description || "",
        quantity: String(item.quantity),
        unit: item.unit || "",
      }));
    const nextInvalid = {};
    if (!form.projectId) nextInvalid.project = true;
    if (!form.departmentId) nextInvalid.department = true;
    if (!form.priority) nextInvalid.priority = true;
    if (!String(form.justification || "").trim()) nextInvalid.justification = true;
    if (status === "Requested" && form.projectId && form.departmentId && !manager) nextInvalid.manager = true;
    if (!products.length) {
      const anyStarted = form.products.some((item) => item.productId || item.quantity);
      form.products.forEach((item, index) => {
        const started = Boolean(item.productId || item.quantity);
        if (!started && (index !== 0 || anyStarted)) return;
        if (!item.productId) nextInvalid[`product-${index}`] = true;
        if (!item.quantity) nextInvalid[`qty-${index}`] = true;
      });
    } else {
      form.products.forEach((item, index) => {
        if (item.productId && !item.quantity) nextInvalid[`qty-${index}`] = true;
        if (!item.productId && item.quantity) nextInvalid[`product-${index}`] = true;
      });
    }
    if (Object.keys(nextInvalid).length) {
      setInvalid(nextInvalid);
      setError("");
      setShakeKey((value) => value + 1);
      setLoading(false);
      return;
    }
    setInvalid({});
    setLoading(true);
    try {
      const payload = {
        projectId: form.projectId,
        departmentId: form.departmentId,
        location: form.location,
        region: form.region,
        city: form.city,
        justification: form.justification,
        priority: form.priority,
        products,
        status,
      };
      const response = isEdit
        ? await api.put(`/material-requests/${id}`, payload)
        : await api.post("/material-requests", payload);
      dispatch(saveMaterialRequest(response.materialRequest));
      navigate("/material-requests");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSaveDraft = async (event) => {
    event.preventDefault();
    await saveRequest("Draft");
  };

  return (
    <div className="space-y-5">
      <PageIntro
        kicker="Request"
        title={isEdit ? `Edit ${id}` : "New Material Request Form"}
      />
      <GlassPanel as="article" className="p-5 sm:p-6">
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <form className="space-y-5" noValidate onSubmit={onSaveDraft}>
          <div className="grid gap-3 sm:grid-cols-2">
            {isEdit ? (
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm text-white/70">MR No.</span>
                <input className={fieldClass} value={id} disabled />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Project</span>
              <SearchSelect
                value={form.projectId}
                onChange={onProjectChange}
                placeholder="Select project"
                required
                invalid={Boolean(invalid.project)}
                shakeKey={shakeKey}
                options={projectOptions}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Department</span>
              <SearchSelect
                value={form.departmentId}
                onChange={onDepartmentChange}
                placeholder="Select department"
                required
                invalid={Boolean(invalid.department)}
                shakeKey={shakeKey}
                options={departmentOptions.map((item) => ({ value: item.id, label: item.name }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Location</span>
              <input
                className={fieldClass}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Site or location"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Region</span>
              <input
                className={fieldClass}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="Region"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">City</span>
              <input
                className={fieldClass}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="City"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Assigned manager</span>
              <ShakeBox active={Boolean(invalid.manager)} shakeKey={shakeKey}>
              <input
                className={`${fieldClass} ${invalid.manager ? "field-invalid" : ""}`}
                value={
                  manager?.name ||
                  (form.projectId && form.departmentId
                    ? "No manager appointed for this project and department"
                    : "Select a project and department first")
                }
                disabled
              />
              </ShakeBox>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Priority</span>
              <SearchSelect
                value={form.priority}
                onChange={(priority) => {
                  clearInvalid("priority");
                  setForm({ ...form, priority });
                }}
                placeholder="Select priority"
                required
                invalid={Boolean(invalid.priority)}
                shakeKey={shakeKey}
                options={PRIORITIES}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-white/70">Description</span>
              <ShakeBox active={Boolean(invalid.justification)} shakeKey={shakeKey}>
              <input
                className={`${fieldClass} ${invalid.justification ? "field-invalid" : ""}`}
                value={form.justification}
                onChange={(e) => {
                  clearInvalid("justification");
                  setForm({ ...form, justification: e.target.value });
                }}
                placeholder="Why is this needed?"
                required
              />
              </ShakeBox>
            </label>
          </div>

          <div className="space-y-3 rounded-[22px] border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-sm font-semibold">Materials</p>
              <p className="text-xs text-white/50">
                Department products stay with that department. Stationery items are shown to every user.
              </p>
            </div>

            <div className="hidden gap-2 text-[11px] uppercase tracking-[0.14em] text-white/45 sm:grid sm:grid-cols-12">
              <span className="sm:col-span-4">P. id</span>
              <span className="sm:col-span-4">Material name</span>
              <span className="sm:col-span-2">Qty</span>
              <span className="sm:col-span-2 text-center">Actions</span>
            </div>

            {form.products.map((product, index) => {
              const taken = new Set(
                form.products
                  .filter((_, itemIndex) => itemIndex !== index)
                  .map((item) => item.productId)
                  .filter(Boolean)
              );
              const options = matchingMaterials.filter(
                (item) => item.productId === product.productId || !taken.has(item.productId)
              );
              const productOptions = [
                ...(product.productId && !options.some((item) => item.productId === product.productId)
                  ? [{ productId: product.productId, name: product.name || product.productId }]
                  : []),
                ...options,
              ];
              const anotherRowChosen = form.products.some(
                (item, itemIndex) => itemIndex !== index && item.productId
              );
              const productRequired = Boolean(product.productId) || !anotherRowChosen;
              const ready = Boolean(form.projectId && form.departmentId);
              return (
                <div key={`product-${index}`} className="grid gap-2 sm:grid-cols-12 sm:items-center">
                  <SearchSelect
                    className="sm:col-span-4"
                    value={product.productId}
                    onChange={(productId) => chooseMaterial(index, productId)}
                    placeholder={ready ? "Select product" : "Select project and department first"}
                    required={productRequired}
                    invalid={Boolean(invalid[`product-${index}`])}
                    shakeKey={shakeKey}
                    disabled={!ready}
                    options={productOptions.map((item) => ({
                      value: item.productId,
                      label: item.name ? `${item.productId} — ${item.name}` : item.productId,
                    }))}
                  />
                  <SearchSelect
                    className="sm:col-span-4"
                    value={product.productId}
                    onChange={(productId) => chooseMaterial(index, productId)}
                    placeholder="Material name"
                    required={productRequired}
                    invalid={Boolean(invalid[`product-${index}`])}
                    shakeKey={shakeKey}
                    disabled={!ready}
                    options={productOptions.map((item) => ({
                      value: item.productId,
                      label: item.name || item.productId,
                    }))}
                  />
                  <ShakeBox
                    active={Boolean(invalid[`qty-${index}`])}
                    shakeKey={shakeKey}
                    className="sm:col-span-2"
                  >
                  <input
                    className={`${fieldClass} ${invalid[`qty-${index}`] ? "field-invalid" : ""}`}
                    placeholder="Qty"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={product.quantity}
                    onChange={(e) =>
                      updateProduct(index, { quantity: e.target.value.replace(/\D/g, "") })
                    }
                    required={Boolean(product.productId)}
                  />
                  </ShakeBox>
                  <div className="flex items-center justify-center gap-2 sm:col-span-2">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal text-lg font-semibold text-white shadow-[0_6px_16px_rgba(4,167,147,0.35)] hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        const products = [...form.products];
                        products.splice(index + 1, 0, emptyProduct());
                        setForm({ ...form, products });
                      }}
                      aria-label="Add material row"
                      title="Add row"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-lg font-semibold text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)] hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        setForm({
                          ...form,
                          products: form.products.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      disabled={form.products.length <= 1}
                      aria-label="Remove material row"
                      title="Remove row"
                    >
                      −
                    </button>
                  </div>
                </div>
              );
            })}
            {form.projectId && form.departmentId && !matchingMaterials.length ? (
              <p className="text-xs text-white/55">
                No materials are listed for this project and department yet. Add them from the Materials page.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className={ghostBtn} disabled={loading}>
              {loading ? "Saving..." : "Save as draft"}
            </button>
            <button
              type="button"
              className={approveBtn}
              disabled={loading}
              onClick={() => saveRequest("Requested")}
            >
              {loading ? "Sending..." : "Send request"}
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => navigate("/material-requests")}
            >
              Cancel
            </button>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}
