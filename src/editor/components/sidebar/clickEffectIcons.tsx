import type { ReactNode } from "react";
import type { ClickEffectStyle } from "@/shared/settings";

const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export const CLICK_EFFECT_OPTIONS: readonly { value: ClickEffectStyle; label: string; icon: ReactNode }[] = [
  {
    value: "none",
    label: "None",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />
        <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    value: "ripple",
    label: "Ripple",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
  },
  {
    value: "highlight",
    label: "Highlight",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <radialGradient id="click-highlight-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <circle cx="8" cy="8" r="6.5" fill="url(#click-highlight-gradient)" />
        <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  {
    value: "halo",
    label: "Halo",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
        <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      </svg>
    ),
  },
  {
    value: "burst",
    label: "Burst",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        {BURST_ANGLES.map((degrees) => {
          const radians = (degrees * Math.PI) / 180;
          return (
            <line
              key={degrees}
              x1={8 + Math.cos(radians) * 3}
              y1={8 + Math.sin(radians) * 3}
              x2={8 + Math.cos(radians) * 6}
              y2={8 + Math.sin(radians) * 6}
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              opacity="0.8"
            />
          );
        })}
      </svg>
    ),
  },
];
