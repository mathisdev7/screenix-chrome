export const COUNTDOWN_PORT_NAME = "screenix-countdown";

export const COUNTDOWN_SECONDS = [0, 3, 5, 10] as const;

export type CountdownSeconds = (typeof COUNTDOWN_SECONDS)[number];

export type CountdownCommand = { type: "show"; endsAt: number } | { type: "hide" };

export type CountdownReply = { type: "cancel" } | { type: "hidden" };
