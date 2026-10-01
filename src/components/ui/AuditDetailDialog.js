import GlassPanel from "./GlassPanel";
import { ghostBtn } from "./formStyles";

function Row({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 border-t border-white/8 py-2 first:border-t-0 first:pt-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</dt>
      <dd className="break-all text-sm text-white/85">{value}</dd>
    </div>
  );
}

function formatMeta(meta) {
  if (!meta || typeof meta !== "object" || !Object.keys(meta).length) return "";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export default function AuditDetailDialog({ audit, onClose }) {
  if (!audit) return null;
  const meta = formatMeta(audit.meta);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <GlassPanel className="relative z-10 max-h-[85vh] w-full max-w-xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-teal">Audit detail</p>
            <h2 className="mt-1 text-lg font-semibold">{audit.action?.replace(/_/g, " ") || "Event"}</h2>
          </div>
          <button type="button" className={ghostBtn} onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="mt-4">
          <Row label="When" value={audit.date} />
          <Row label="Company" value={audit.company} />
          <Row label="Who" value={audit.who || audit.actorRole} />
          <Row label="Name" value={audit.actorName} />
          <Row label="Email" value={audit.actorEmail} />
          <Row label="Role" value={audit.actorRole} />
          <Row label="Module" value={audit.module?.replace(/_/g, " ")} />
          <Row label="Summary" value={audit.summary} />
          <Row label="Target" value={[audit.targetType, audit.targetId].filter(Boolean).join(" · ")} />
          <Row label="Accessed from IP" value={audit.ip || "Not recorded"} />
          <Row label="Browser / device" value={audit.userAgent || "Not recorded"} />
        </dl>
        {meta ? (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">Extra details</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-white/5 p-3 text-xs text-white/75">{meta}</pre>
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}
