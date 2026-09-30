import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import RoleManager from "../../features/roles/RoleManager";
import { PageIntro } from "../../components/ui/GlassPanel";
import { hasPrivilege } from "../../constants/privileges";

export default function Roles() {
  const roleKey = useSelector((state) => state.auth.role?.key);
  const privileges = useSelector((state) => state.auth.privileges);
  if (roleKey !== "super_admin" || !hasPrivilege(privileges, "roles", "view")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-5">
      <PageIntro kicker="Directory" title="Roles" />
      <RoleManager />
    </div>
  );
}
