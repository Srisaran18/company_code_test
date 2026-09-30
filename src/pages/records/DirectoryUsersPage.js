import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import UserManager from "../../features/users/UserManager";
import { PageIntro } from "../../components/ui/GlassPanel";
import { hasPrivilege } from "../../constants/privileges";

export default function DirectoryUsers({ title, privilegeKey, roleKeys }) {
  const privileges = useSelector((state) => state.auth.privileges);
  if (!hasPrivilege(privileges, privilegeKey, "view")) return <Navigate to="/" replace />;

  return (
    <div className="space-y-5">
      <PageIntro kicker="Directory" title={title} />
      <UserManager title={title} privilegeKey={privilegeKey} roleKeys={roleKeys} />
    </div>
  );
}
