import { connectPointerTracker } from "./pointerTracking";

if (!window.__screenixPointerTracker) connectPointerTracker();
