import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import GlassPanel from "../../components/ui/GlassPanel";
import { clearError, login } from "../../store/authSlice";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = useSelector((state) => state.auth.error);
  const loading = useSelector((state) => state.auth.loading);
  const dispatch = useDispatch();

  const onSubmit = (event) => {
    event.preventDefault();
    dispatch(clearError());
    dispatch(login({ email, password }));
  };

  return (
    <div className="theme-rest relative min-h-screen">
      <div className="aurora" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <GlassPanel className="w-full max-w-md p-8">
          <p className="text-sm font-medium text-brand-teal">ServHub</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-white/55">Use your workspace credentials to continue.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/20 bg-white py-2.5 px-4 text-sm text-brand-navy outline-none placeholder:text-brand-navy/45 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
                placeholder="you@erp.com"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-white/70">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/20 bg-white py-2.5 px-4 text-sm text-brand-navy outline-none placeholder:text-brand-navy/45 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
                placeholder="••••••••"
              />
            </label>
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-brand-blue py-2.5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(4,114,223,0.35)] hover:bg-brand-blue-dark"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
