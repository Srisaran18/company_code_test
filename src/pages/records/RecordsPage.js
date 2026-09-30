import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import RecordManager from "../../features/records/RecordManager";
import { PageIntro } from "../../components/ui/GlassPanel";
import { getModuleByPath } from "../../constants/nav";
import { recordModules } from "../../features/records/records";
import { hasPrivilege } from "../../constants/privileges";

export default function Records() {
  const location = useLocation();
  const privileges = useSelector((state) => state.auth.privileges);
  const moduleKey = getModuleByPath(location.pathname);
  const config = recordModules[moduleKey];

  if (!moduleKey || !config || !hasPrivilege(privileges, moduleKey, "view")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-5">
      <PageIntro kicker="Operations" title={config.title} />
      <RecordManager moduleKey={moduleKey} config={config} />
    </div>
  );
}
