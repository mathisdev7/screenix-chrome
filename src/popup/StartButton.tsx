import { Menu } from "@base-ui/react/menu";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { COUNTDOWN_SECONDS, type CountdownSeconds } from "@/shared/countdown";

export function StartButton({ countdown, onCountdownChange, onStart }: {
  countdown: CountdownSeconds;
  onCountdownChange: (countdown: CountdownSeconds) => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="popup-start">
        <button type="button" onClick={onStart} className="popup-start-main">
          <span className="popup-record-dot" />
          Start recording
        </button>
        <Menu.Root>
          <Menu.Trigger aria-label="Countdown" className="popup-start-countdown">
            {countdown ? `${countdown}s` : "Now"}
            <IconChevronDown size={12} stroke={2} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="top" align="end" sideOffset={6} collisionPadding={8} className="z-50">
              <Menu.Popup className="popup-menu w-[176px]">
                <Menu.RadioGroup value={String(countdown)} onValueChange={(value) => onCountdownChange(Number(value) as CountdownSeconds)}>
                  {COUNTDOWN_SECONDS.map((seconds) => (
                    <Menu.RadioItem key={seconds} value={String(seconds)} className="popup-menu-item">
                      <span className="popup-menu-check">
                        <Menu.RadioItemIndicator>
                          <IconCheck size={12} stroke={2.2} />
                        </Menu.RadioItemIndicator>
                      </span>
                      {seconds === 0 ? "No countdown" : `${seconds} second countdown`}
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        or press <kbd className="font-sans text-foreground/80">Alt+Shift+R</kbd>
      </p>
    </div>
  );
}
