import { useCallback, useEffect, useState } from "react";
import type { ProjectId } from "@/shared/types";
import { LicenseDialog } from "./components/LicenseDialog";
import { openLicenseDialog } from "./hooks/useLicense";
import { EditorPage } from "./pages/EditorPage";
import { ProjectsPage } from "./pages/ProjectsPage";

const PROJECT_PARAM = "project";
const LICENSE_PARAM = "license";

function projectFromLocation(): ProjectId | null {
  return new URLSearchParams(location.search).get(PROJECT_PARAM);
}

export function App() {
  const [projectId, setProjectId] = useState<ProjectId | null>(projectFromLocation);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has(LICENSE_PARAM)) return;
    params.delete(LICENSE_PARAM);
    history.replaceState(null, "", params.size > 0 ? `?${params}` : location.pathname);
    openLicenseDialog();
  }, []);

  useEffect(() => {
    const onPopState = () => setProjectId(projectFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: ProjectId | null) => {
    history.pushState(null, "", next ? `?${PROJECT_PARAM}=${next}` : location.pathname);
    setProjectId(next);
  }, []);

  return (
    <>
      {projectId
        ? <EditorPage key={projectId} projectId={projectId} onHome={() => navigate(null)} />
        : <ProjectsPage onOpen={navigate} />}
      <LicenseDialog />
    </>
  );
}
