import { ghostBtn, primaryBtn, fieldClass } from "./formStyles";
import GlassPanel from "./GlassPanel";

export default function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
  children,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy/55 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close"
      />
      <GlassPanel className="relative z-10 w-full max-w-md p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {message ? <p className="mt-2 text-sm text-white/65">{message}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={
              danger
                ? "rounded-2xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                : primaryBtn
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}

export { fieldClass };
