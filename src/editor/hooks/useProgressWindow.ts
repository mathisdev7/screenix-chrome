import { useCallback, useEffect, useRef, useState } from "react";

const WINDOW_SIZE = { width: 320, height: 120 };

function copyStyles(target: Document) {
  for (const node of document.head.querySelectorAll('link[rel="stylesheet"], style')) target.head.append(node.cloneNode(true));
  target.documentElement.className = document.documentElement.className;
}

async function requestProgressWindow(): Promise<Window | null> {
  const pictureInPicture = window.documentPictureInPicture;
  if (!pictureInPicture) return null;
  if (pictureInPicture.window) return pictureInPicture.window;
  try {
    const target = await pictureInPicture.requestWindow(WINDOW_SIZE);
    copyStyles(target.document);
    return target;
  } catch {
    return null;
  }
}

export function useProgressWindow() {
  const [target, setTarget] = useState<Window | null>(null);
  const wanted = useRef(false);

  const open = useCallback(async () => {
    wanted.current = true;
    const opened = await requestProgressWindow();
    if (!opened) return;
    if (!wanted.current) return opened.close();
    opened.addEventListener("pagehide", () => setTarget(null), { once: true });
    setTarget(opened);
  }, []);

  const close = useCallback(() => {
    wanted.current = false;
    window.documentPictureInPicture?.window?.close();
    setTarget(null);
  }, []);

  useEffect(() => close, [close]);

  return { target, open, close };
}
