import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import DepartmentManager from "../../features/departments/DepartmentManager";
import { PageIntro } from "../../components/ui/GlassPanel";

export default function Departments() {
  const roleKey = useSelector((state) => state.auth.role?.key);
  if (roleKey !== "super_admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-5">
      <PageIntro kicker="Access" title="Departments" />
      <DepartmentManager />
    </div>
  );
}
