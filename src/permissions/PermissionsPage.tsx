import { useCallback, useEffect, useState } from "react";
import { requestMediaAccess, type MediaKind } from "@/shared/mediaAccess";
import { ActionButton } from "@/editor/components/controls";

const CLOSE_DELAY_MS = 1200;

type RequestState = { status: "asking" } | { status: "granted" } | { status: "denied" };

function requestedKinds(): MediaKind[] {
  const kinds = new URLSearchParams(location.search).get("kinds")?.split(",") ?? [];
  const valid = kinds.filter((kind): kind is MediaKind => kind === "microphone" || kind === "camera");
  return valid.length > 0 ? valid : ["microphone", "camera"];
}

function describe(kinds: MediaKind[]): string {
  return kinds.length === 2 ? "microphone and camera" : kinds[0];
}

export function PermissionsPage() {
  const [kinds] = useState(requestedKinds);
  const [state, setState] = useState<RequestState>({ status: "asking" });

  const request = useCallback(() => {
    requestMediaAccess(kinds).then(
      () => {
        setState({ status: "granted" });
        setTimeout(() => window.close(), CLOSE_DELAY_MS);
      },
      () => setState({ status: "denied" }),
    );
  }, [kinds]);

  const retry = () => {
    setState({ status: "asking" });
    request();
  };

  useEffect(request, [request]);

  return (
    <main className="screenix-editor grid min-h-full place-items-center bg-background p-6">
      <div className="w-[380px] space-y-4 rounded-xl border bg-surface-1 p-6 text-center">
        <img src="/icons/icon-48.png" alt="" className="mx-auto size-10" />
        <h1 className="text-[15px] font-semibold">Allow your {describe(kinds)}</h1>
        {state.status === "asking" && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">Choose Allow in Chrome's prompt so Screenix can record your {describe(kinds)}.</p>
        )}
        {state.status === "granted" && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">Access granted. You can start recording from the Screenix popup.</p>
        )}
        {state.status === "denied" && (
          <>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Chrome blocked access. Click the camera icon in the address bar to allow it, then try again.
            </p>
            <ActionButton onClick={retry}>Try again</ActionButton>
          </>
        )}
      </div>
    </main>
  );
}
