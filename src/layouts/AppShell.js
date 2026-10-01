import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet } from "react-router-dom";
import { getNavItems } from "../constants/nav";
import { api } from "../services/api";
import { refreshDirectory, syncCurrentUser } from "../store/authSlice";
import { setMaterialRequests } from "../store/workflowSlice";
import NoPlanPage from "../pages/auth/NoPlanPage";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function resolveTheme(theme) {
  if (theme === "night") return "night";
  if (theme === "day") return "day";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "night";
  }
  return "day";
}

export default function AppShell() {
  const dispatch = useDispatch();
  const [navVisible, setNavVisible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const privileges = useSelector((state) => state.auth.privileges);
  const roleKey = useSelector((state) => state.auth.role?.key);
  const company = useSelector((state) => state.auth.company);
  const planMissing = roleKey !== "platform_admin" && Boolean(company) && !company.plan?.mode;
  const features = useSelector((state) => state.auth.features);
  const catalog = useSelector((state) => state.auth.permissionCatalog);
  const canLoadRequests = roleKey !== "platform_admin" && Boolean(privileges?.material_requests?.includes("view"));
  const themePreference = useSelector((state) => state.directory.settings?.theme || "day");
  const [resolved, setResolved] = useState(() => resolveTheme(themePreference));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dispatch(syncCurrentUser());
      } catch {
        // session stays as last persisted until the next successful fetch
      }
      try {
        await dispatch(refreshDirectory());
      } catch {
        // directory stays empty until the next successful fetch
      }
      if (!canLoadRequests) {
        dispatch(setMaterialRequests([]));
        return;
      }
      try {
        const response = await api.get("/material-requests");
        if (!cancelled) dispatch(setMaterialRequests(response.materialRequests || []));
      } catch {
        if (!cancelled) dispatch(setMaterialRequests([]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadRequests, dispatch]);

  useEffect(() => {
    const refreshFeatures = () => {
      if (document.visibilityState === "visible") dispatch(syncCurrentUser());
    };
    window.addEventListener("focus", refreshFeatures);
    document.addEventListener("visibilitychange", refreshFeatures);
    return () => {
      window.removeEventListener("focus", refreshFeatures);
      document.removeEventListener("visibilitychange", refreshFeatures);
    };
  }, [dispatch]);

  useEffect(() => {
    const apply = () => setResolved(resolveTheme(themePreference));
    apply();
    if (themePreference !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themePreference]);

  const themeClass = resolved === "day" ? "theme-rest" : "theme-night";

  return (
    <div className={`${themeClass} relative min-h-screen`}>
      <div className="aurora" />
      {planMissing ? null : (
        <Sidebar
          items={getNavItems(privileges, roleKey, features, catalog)}
          visible={navVisible}
          pinned={pinned}
          onTogglePin={() => setPinned((value) => !value)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      )}
      <TopBar
        navOpen={mobileOpen}
        navVisible={navVisible}
        onMenu={() => setMobileOpen((value) => !value)}
        onToggleNav={() => {
          setNavVisible((value) => {
            const next = !value;
            if (!next) {
              setPinned(false);
              setMobileOpen(false);
            }
            return next;
          });
        }}
      />
      <div
        className={`relative z-10 flex min-h-screen flex-col px-3 pb-4 pt-[5.75rem] transition-[padding] duration-[850ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] lg:px-4 ${
          planMissing || !navVisible ? "lg:pl-4" : pinned ? "lg:pl-[17.25rem]" : "lg:pl-[5.75rem]"
        }`}
      >
        <main className="flex min-h-0 flex-1 flex-col">
          {planMissing ? <NoPlanPage /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
