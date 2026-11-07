import type { PageCameraBubble } from "./cameraBubbleStyle";

export const COUNTDOWN_PORT_NAME = "screenix-countdown";

export const COUNTDOWN_SECONDS = [0, 3, 5, 10] as const;

export type CountdownSeconds = (typeof COUNTDOWN_SECONDS)[number];

export interface CountdownCamera extends PageCameraBubble {
  recorded: boolean;
}

export type CountdownCommand =
  | { type: "notice" }
  | { type: "show"; endsAt: number; camera: CountdownCamera | null; dial: boolean }
  | { type: "hide"; completed: boolean };

export interface PagePoint {
  x: number;
  y: number;
}

export interface TabPoint extends PagePoint {
  tabId: number;
}

export type CountdownReply = { type: "cancel" } | { type: "noticed"; hideForever: boolean } | { type: "hidden"; pointer: PagePoint | null };
