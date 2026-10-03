import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate } from "react-router-dom";
import GlassPanel, { PageIntro } from "../../components/ui/GlassPanel";
import { fieldClass, ghostBtn, primaryBtn } from "../../components/ui/formStyles";
import { icons } from "../../components/icons";
import { api } from "../../services/api";
import { saveSettings } from "../../store/directorySlice";
import { hasPrivilege } from "../../constants/privileges";
import { isModuleEnabled } from "../../constants/nav";

const THEMES = [
  { id: "day", label: "Day", icon: "sun" },
  { id: "night", label: "Night", icon: "moon" },
  { id: "system", label: "System", icon: "system" },
];

function SignaturePad({ onDraw }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const moved = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f2a44";
  }, []);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = event.touches ? event.touches[0] : event;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (event) => {
    drawing.current = true;
    moved.current = false;
    canvasRef.current.setPointerCapture?.(event.pointerId);
    const ctx = canvasRef.current.getContext("2d");
    const next = point(event);
    ctx.beginPath();
    ctx.moveTo(next.x, next.y);
  };

  const move = (event) => {
    if (!drawing.current) return;
    if (event.cancelable) event.preventDefault();
    moved.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const next = point(event);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (moved.current) onDraw(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    onDraw("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-36 w-full max-w-xl cursor-crosshair touch-none rounded-2xl bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button type="button" className={`${ghostBtn} mt-2`} onClick={clear}>
        Clear
      </button>
    </div>
  );
}

export default function Settings() {
  const dispatch = useDispatch();
  const privileges = useSelector((state) => state.auth.privileges);
  const roleKey = useSelector((state) => state.auth.role?.key);
  const user = useSelector((state) => state.auth.user);
  const settings = useSelector((state) => state.directory.settings);
  const company = useSelector((state) => state.auth.company);
  const features = useSelector((state) => state.auth.features);
  const catalog = useSelector((state) => state.auth.permissionCatalog);
  const companySettingsOn = isModuleEnabled("company_settings", features, catalog);
  const canManageCompany =
    companySettingsOn && (roleKey === "super_admin" || hasPrivilege(privileges, "company_settings", "view"));
  const isUser = roleKey === "user" || roleKey === "requestor" || roleKey === "requester";
  const [theme, setTheme] = useState(settings.theme || "day");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);
  const isPlatformAdmin = roleKey === "platform_admin";

  useEffect(() => {
    setTheme(settings.theme || "day");
  }, [settings.theme]);

  useEffect(() => {
    if (isPlatformAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/users/me");
        if (!cancelled) setSignature(data.user?.signatureData || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load signature");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin]);

  if (roleKey !== "platform_admin" && roleKey !== "super_admin" && !hasPrivilege(privileges, "settings", "view") && roleKey !== "user") {
    return <Navigate to="/" replace />;
  }

  const onUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Signature must be a PNG or JPEG image");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Signature must be smaller than 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setSignature(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const saveSignature = async () => {
    setSavingSignature(true);
    setError("");
    setMessage("");
    try {
      const data = await api.put("/users/me", { signatureData: signature || "" });
      setSignature(data.user?.signatureData || "");
      setMessage(signature ? "Signature saved. It prints on your line in the material request PDF." : "Signature removed.");
    } catch (err) {
      setError(err.message || "Failed to save signature");
    } finally {
      setSavingSignature(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    try {
      await api.put("/users/me/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password updated");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro kicker="Account" title="Settings" />
      {message ? <p className="text-sm text-brand-teal">{message}</p> : null}
      {error ? <p className="text-sm text-red-200">{error}</p> : null}

      <GlassPanel as="article" className="p-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-1 text-sm text-white/50">Name and email are managed by your admin.</p>
        <div className="mt-4 grid max-w-xl gap-3">
          <div>
            <p className="mb-1.5 text-sm text-white/70">Name</p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium">
              {user?.name || "—"}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-white/70">Email</p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium">
              {user?.email || "—"}
            </p>
          </div>
        </div>
      </GlassPanel>

      {isPlatformAdmin ? null : (
        <GlassPanel as="article" className="p-6">
          <h2 className="text-lg font-semibold">Signature</h2>
          <p className="mt-1 text-sm text-white/50">Sign in the box, or upload a PNG or JPEG. Saved on your account and printed on your PDF line.</p>
          <div className="mt-4 grid max-w-xl gap-4">
            <SignaturePad onDraw={setSignature} />
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-2xl bg-white">
                {signature ? (
                  <img src={signature} alt="Your signature" className="max-h-14 max-w-[9rem] object-contain" />
                ) : (
                  <span className="text-xs text-brand-navy/45">No signature yet</span>
                )}
              </div>
              <label className={`${ghostBtn} cursor-pointer`}>
                Upload signature
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onUpload} />
              </label>
              {signature ? (
                <button type="button" className={ghostBtn} onClick={() => setSignature("")}>
                  Remove
                </button>
              ) : null}
            </div>
            <div>
              <button type="button" className={primaryBtn} disabled={savingSignature} onClick={saveSignature}>
                {savingSignature ? "Saving..." : "Save signature"}
              </button>
            </div>
          </div>
        </GlassPanel>
      )}

      <GlassPanel as="article" className="p-6">
        <h2 className="text-lg font-semibold">Change password</h2>
        <form className="mt-4 grid max-w-xl gap-3" onSubmit={savePassword}>
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/70">Current password</span>
            <input
              type="password"
              className={fieldClass}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/70">New password</span>
            <input
              type="password"
              className={fieldClass}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/70">Confirm new password</span>
            <input
              type="password"
              className={fieldClass}
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <div>
            <button type="submit" className={primaryBtn}>
              Update password
            </button>
          </div>
        </form>
      </GlassPanel>

      <GlassPanel as="article" className="p-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-white/50">Choose Day, Night, or follow your system setting.</p>
        <div className="mt-4 inline-flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                theme === item.id
                  ? "bg-brand-blue text-white shadow-[0_6px_16px_rgba(4,114,223,0.35)]"
                  : "text-white/70 hover:bg-white/10"
              }`}
              onClick={() => {
                setTheme(item.id);
                dispatch(saveSettings({ theme: item.id }));
                setMessage("Theme updated");
                setError("");
              }}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center">{icons[item.icon]}</span>
              {item.label}
            </button>
          ))}
        </div>
      </GlassPanel>

      {!isUser && company && companySettingsOn ? (
        <GlassPanel as="article" className="p-6">
          <h2 className="text-lg font-semibold">Organization</h2>
          <p className="mt-2 text-sm text-white/70">
            {company.name} ({company.code}) · {company.currency} · {company.timezone}
          </p>
          {canManageCompany ? (
            <Link to="/company" className={`${primaryBtn} mt-4 inline-flex`}>
              Company settings
            </Link>
          ) : null}
        </GlassPanel>
      ) : null}
    </div>
  );
}
