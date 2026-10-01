import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import GlassPanel from "../../components/ui/GlassPanel";
import { clearError, login } from "../../store/authSlice";

function EyeIcon({ off }) {
  return off ? (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 10.7A2 2 0 0 0 12 14a2 2 0 0 0 1.3-.5M9.9 5.1A10.8 10.8 0 0 1 12 5c5 0 9.3 3.1 11 7a11.6 11.6 0 0 1-4.1 4.9M6.1 6.1C4.2 7.4 2.7 9.1 1.8 12c1.1 2.4 3.2 4.5 5.7 5.8" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/20 bg-white py-2.5 pl-4 pr-12 text-sm text-brand-navy outline-none placeholder:text-brand-navy/45 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-1.5 inline-flex w-10 items-center justify-center rounded-xl text-brand-navy/45 hover:text-brand-navy"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </span>
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
