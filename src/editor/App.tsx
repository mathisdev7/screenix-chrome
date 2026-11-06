import { useCallback, useEffect, useState } from "react";
import type { ProjectId } from "@/shared/types";
import { LicenseDialog } from "./components/LicenseDialog";
import { RatingDialog } from "./components/RatingDialog";
import { openLicenseDialog } from "./hooks/useLicense";
import { EditorPage } from "./pages/EditorPage";
import { InstantPage } from "./pages/InstantPage";
import { ProjectsPage } from "./pages/ProjectsPage";

const PROJECT_PARAM = "project";
const INSTANT_PARAM = "instant";
const LICENSE_PARAM = "license";

type Route = { view: "projects" } | { view: "editor" | "instant"; projectId: ProjectId };

function routeFromLocation(): Route {
  const params = new URLSearchParams(location.search);
  const instant = params.get(INSTANT_PARAM);
  if (instant) return { view: "instant", projectId: instant };
  const project = params.get(PROJECT_PARAM);
  return project ? { view: "editor", projectId: project } : { view: "projects" };
}

function routeUrl(route: Route): string {
  if (route.view === "projects") return location.pathname;
  return `?${route.view === "instant" ? INSTANT_PARAM : PROJECT_PARAM}=${route.projectId}`;
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has(LICENSE_PARAM)) return;
    params.delete(LICENSE_PARAM);
    history.replaceState(null, "", params.size > 0 ? `?${params}` : location.pathname);
    openLicenseDialog();
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: Route) => {
    history.pushState(null, "", routeUrl(next));
    setRoute(next);
  }, []);

  const home = () => navigate({ view: "projects" });

  return (
    <>
      {route.view === "projects" && <ProjectsPage onOpen={(projectId) => navigate({ view: "editor", projectId })} />}
      {route.view === "editor" && <EditorPage key={route.projectId} projectId={route.projectId} onHome={home} />}
      {route.view === "instant" && (
        <InstantPage
          key={route.projectId}
          projectId={route.projectId}
          onHome={home}
          onEdit={() => navigate({ view: "editor", projectId: route.projectId })}
        />
      )}
      <LicenseDialog />
      <RatingDialog />
    </>
  );
}
