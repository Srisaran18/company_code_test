import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import PrivilegeManager from "../../features/privileges/PrivilegeManager";
import { PageIntro } from "../../components/ui/GlassPanel";
import { hasPrivilege } from "../../constants/privileges";

export default function Privileges() {
  const roleKey = useSelector((state) => state.auth.role?.key);
  const privileges = useSelector((state) => state.auth.privileges);
  if (roleKey !== "super_admin" || !hasPrivilege(privileges, "privileges", "view")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-5">
      <PageIntro kicker="Access" title="Privileges" />
      <PrivilegeManager />
    </div>
  );
}
