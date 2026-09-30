import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { homePathForRole } from "../constants/nav";

export function ProtectedRoute() {
  const user = useSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const user = useSelector((state) => state.auth.user);
  const roleKey = useSelector((state) => state.auth.role?.key);
  if (user) return <Navigate to={homePathForRole(roleKey)} replace />;
  return <Outlet />;
}
