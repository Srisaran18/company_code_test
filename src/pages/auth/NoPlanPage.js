import { useSelector } from "react-redux";
import GlassPanel from "../../components/ui/GlassPanel";

export default function NoPlanPage() {
  const company = useSelector((state) => state.auth.company);
  const roleKey = useSelector((state) => state.auth.role?.key);
  const isAdmin = roleKey === "super_admin";
  const companyName = company?.name || "Your company";

  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <GlassPanel className="w-full max-w-xl p-8 sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M4.9 19h14.2a2 2 0 0 0 1.8-2.8l-7.1-12a2 2 0 0 0-3.6 0l-7.1 12A2 2 0 0 0 4.9 19Z" />
          </svg>
        </div>
        <p className="mt-6 text-sm font-medium text-brand-teal">{companyName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">No plan is active</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          {companyName} is signed in, and the workspace is waiting. A demo or subscription has not been chosen yet, so the menus stay closed until a plan is active.
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold">What to do next</p>
          <p className="mt-1 text-sm leading-6 text-white/65">
            {isAdmin
              ? "Please contact ServHub. We can start a demo or a subscription and open the features for your team."
              : "Please contact your administrators. They can ask ServHub to activate a plan for this company."}
          </p>
        </div>
      </GlassPanel>
    </div>
  );
}
