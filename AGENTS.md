# Screenix for Chrome: Agent Notes

Screenix for Chrome is a Manifest V3 extension that records browser tabs without the system cursor, then re-renders a smooth macOS cursor in a Screenix-style editor and exports MP4/WebM. It is a companion to the Screenix desktop app (`/mnt/other/dev/screenix`) and is a closed-source, paid product: free with a Screenix watermark, unlocked with Screenix license keys.

## Hard rules

- Proprietary code. Keep it clean, small and idiomatic. Match the surrounding style.
- Do not add code comments. Write clearer code instead.
- Do not load or run the extension in the user's browser. The user loads `dist/` in Chrome and reports back.
- Build, type-check, lint and test commands are allowed: `bun run build`, `bun run typecheck`, `bun run lint`, `bun test`.
- After changes, always run `bun test`, `bun run lint` and `bun run build`. The user reloads the unpacked extension from `dist/`.
- Do not commit unless the user asks.
- Do not edit `dist/`, `node_modules/` or the copied cursor artwork in `public/cursors/` unless asked.

## Stack

Bun, Vite 7, React 19, TypeScript (strict), Tailwind v4, `@base-ui/react` primitives (same as the Screenix editor), `@tabler/icons-react`, `mp4-muxer`, `webm-muxer`, Inter via `@fontsource-variable/inter`.

Two Vite builds:
- `vite.config.ts` builds `editor.html`, `popup.html` and the module service worker `background.js`.
- `vite.content.config.ts` builds `src/content/pointerTracker.ts` as a self-contained IIFE, `pointer-tracker.js`. It must not share chunks, because it is injected with `chrome.scripting`.

## Layout

| Path | Role |
|---|---|
| `src/shared/screenixOrigin.ts` | `SCREENIX_ORIGIN`, the only place the website address lives (`http://localhost:3000` during development, `https://screenix.studio` for release). Everything else, including the manifest, derives from it. |
| `src/manifest.ts` | MV3 manifest, emitted as `dist/manifest.json` by a Vite plugin. The license-bridge content script match is built from `SCREENIX_ORIGIN`. Permissions: `alarms`, `debugger`, `downloads`, `offscreen`, `scripting`, `storage`, `tabCapture`, `tabs`, `unlimitedStorage`, `<all_urls>`. Command `toggle-recording` (Alt+Shift+R). |
| `src/background/index.ts` | Service worker entry: popup/command messages, recording status in `chrome.storage.session`, routes tab events and tracker ports to the session. |
| `src/background/recordingSession.ts` | One recording: follows the active tab of the starting window, injects and registers the tracker, writes frames and pointer batches to IndexedDB, builds the project record and thumbnail on stop. |
| `src/background/screencaster.ts` | `chrome.debugger` + CDP `Page.startScreencast` (JPEG). Validates frame timestamps against the wall clock. |
| `src/content/` | Pointer tracker: normalized position, buttons, leave events, CSS cursor shape. Sends batches over a `chrome.runtime` port. |
| `src/shared/` | Types, settings and defaults (`settings.ts`), IndexedDB layer (`db.ts`), messages, cursor shape list. |
| `src/render/cursor/` | Port of the Screenix editor cursor pipeline: `spring.ts`, `timeline.ts` (120 Hz spring timeline, segments), `cursorState.ts` (click bump, drag squeeze, shape transition, sway, idle fade), `clickEffects.ts`, `cursorPainter.ts`, `theme.ts` (macOS Tahoe sprites and hotspots). |
| `src/render/compositor.ts` | Draws one output frame: background, shadow, glass border, rounded or squircle video, click effects, cursor. Preview and export both use it. |
| `src/render/geometry.ts` | Aspect ratios, video and frame placement, squircle path, encoder-aligned export sizes. |
| `src/render/frameSequence.ts` | Frame lookup by time plus an LRU `ImageBitmap` cache with pinning. |
| `src/export/` | WebCodecs encoder (`encoder.ts`) and frame-by-frame export loop (`exportVideo.ts`). |
| `src/editor/` | Editor UI: projects page, editor page, top bar, sidebar panels (Cursor, Ratio, Background), timeline with trim, export dialog, playback clock, undo/redo settings history. |
| `src/popup/` | Toolbar popup: start/stop with timer, link to recordings. |
| `src/styles/` | Theme tokens and sidebar controls copied from the Screenix editor (`ui/src/App.css`, `ui/src/components/editor/sidebar/controls.css`). |

## Data model

- Times are seconds since recording start. Capture-side epoch milliseconds are converted in the service worker.
- Pointer samples are normalized to the tab viewport (0–1) and carry `tabId`, `kind` (`move` / `down` / `up` / `leave`), `button` (DOM numbering, 0 = left) and `shape`.
- IndexedDB `screenix` v1 stores: `projects`, `frames` (`[projectId, seq]`), `pointer` (batches), `assets` (custom wallpaper).
- Editor settings live on the project record and mirror Screenix defaults: cursor size 6.5% of video width, shadow 0.6, speed 0.5, sway 0.3, motion blur 0.5, screen scale 0.85, corner radius 28, shadow blur 40.

## Decisions and why

- **DevTools screencast, not tabCapture or getDisplayMedia.** Chrome draws the system cursor into tabCapture and getDisplayMedia frames, even when the page hides it. Screencast frames contain only page pixels. The cost is the "started debugging this browser" bar and damage-driven frame rate (about 30–60 fps).
- **Screencast across navigations.** The screencast keeps running through navigations, and a second `Page.startScreencast` fails with "Screencast is already active". Starting is therefore stop-then-start, and following the tab that is already streaming is a no-op. Treating that error as a failure used to drop every frame after the first navigation. `screencaster.ts` also restarts on main-frame navigation events and via a watchdog after 1 s without frames (a restart always emits a frame, so static pages get about 1 fps).
- **Camera encoding runs in a worker.** In the offscreen document `OffscreenCanvas.convertToBlob` takes about 1 s per call (hidden-page task throttling), so `cameraEncoderWorker.ts` makes the JPEGs and writes them; the page only reads frames and hands them over.
- **Session exists before tracker injection.** The tracker connects immediately on injection. If the service worker has no session yet, it tells the tracker to stop, and the first tab records no cursor.
- **Leaving the page.** A `leave` sample is clamped to the edge and appended to the segment. A return within 1 s keeps one continuous segment. A longer exit holds at the edge for 0.35 s, then fades over 0.2 s.
- **Debugger bar resize.** The first frames are taller than later ones because the debugger bar appears after attach. With a background on, frames within 15% of the video aspect cover the video, top-anchored, instead of letterboxing.
- **Cursor motion blur is canvas 2D.** It accumulates 2–21 offset copies with `lighter` compositing, the same math as the Screenix WebGL shader. The WebGL version produced dark boxes in exports on the user's GPU.
- **Export encoding.** Constant quality (`bitrateMode: "quantizer"`) when supported. MP4 · AV1 at q24 is the default. Chrome's software H.264 (OpenH264) has no quantizer mode and undershoots its bitrate badly on dark pages, leaving blocky trails, so the dialog warns about it. Export width is aligned to 16 and height to 8.
- **Wallpapers** are fetched from the Screenix CDN (`cdn.usearctic.sh`). Host permissions bypass CORS inside the extension. Plain localhost test pages fall back to the solid color.

## Microphone, camera and tab audio

- Choices live in `chrome.storage.local` (`src/shared/captureSettings.ts`) and are set in the popup (`src/popup/MediaControls.tsx`). Mic and camera need a one-time grant on the extension origin: `permissions.html` (`src/permissions/`) asks for it on a visible tab, because the offscreen document can't show prompts.
- Capture runs in an offscreen document, `recorder.html` (`src/offscreen/`), created by `src/background/mediaCapture.ts` with reasons `USER_MEDIA` and `AUDIO_PLAYBACK`. Media starts before the screencast, and a failure aborts the recording start.
- Tab audio uses `chrome.tabCapture.getMediaStreamId` for the tab the recording starts on. Chrome only allows this for a tab the extension was invoked on, so other tabs' sound isn't captured. The offscreen page routes the captured audio back to the speakers, because tab capture mutes the tab.
- Audio is stored as interleaved Int16 PCM in 1 s chunks (`audio` store), with `startT`, sample rate and channel count on the project (`audioTracks`). Camera frames are JPEGs at up to 30 fps and 540 px tall (`camera` store, same shape as screen frames, `project.camera`). The camera recorder only waits for the JPEG encode before taking the next frame; database writes are queued, because waiting on them dropped frames whenever the screen recording kept IndexedDB busy.
- Editor: `src/render/audioTracks.ts` loads tracks into `AudioBuffer`s; `src/editor/playback/AudioPlayer.ts` plays them in sync with `PlaybackClock` (resyncs past 150 ms drift). The camera bubble is drawn by `src/render/cameraBubble.ts` through the compositor. Settings: `camera` (position, size, roundness, squircle, shadow, mirror) and `audio` (per-track volume, 0–200%).
- Export: `src/export/audioMixer.ts` mixes tracks to 48 kHz stereo; `src/export/audioEncoding.ts` encodes AAC when available, otherwise Opus (WebM always Opus); `src/export/muxer.ts` builds the MP4/WebM with both tracks. Audio blocks are encoded right after each video frame so the muxers get interleaved chunks.

## Licensing and watermark

- Free use is unlimited. Exports without a license get the Screenix watermark (`public/watermark.png`, copied from `src-tauri/ressources/watermark.png`): height 12% of the output, centered, 5% above the bottom, drawn on the whole frame in `src/render/watermark.ts`. The preview never shows it, same as the desktop app.
- Licenses are Screenix license keys (`SCRX-…`), one key per browser. Chrome keys use `license_key.tier = "chrome"` ($19 lifetime each, any quantity). A desktop yearly/lifetime/team key can also activate one browser. Chrome keys are rejected by the desktop activation and verification routes.
- Buying: "Remove watermark" opens `${SCREENIX_ORIGIN}/chrome` (pricing page with a quantity picker). Checkout (`plan: "chrome"`) needs no login and pre-fills the email when signed in. The Stripe webhook reuses the lifetime branch: it finds or creates the account by email, creates the keys and emails them, without changing the account's desktop tier. Stripe returns to `/purchase/success`, which shows the keys with an "Activate in this browser" button.
- Activating: the success-page button talks to `src/content/licenseBridge.ts` (injected on `/purchase/success*`) via `window.postMessage`. The extension's "Have a license key?" dialog (`src/editor/components/LicenseDialog.tsx`, also reachable from the popup via `editor.html?license=1`; when licensed it shows the account, key ending, "Manage licenses" and "Deactivate in this browser") takes a pasted key. Both call `POST /api/chrome/license/activate` with `{ licenseKey, installId }`. `installId` is a random ID kept in `chrome.storage.local`; the key is bound to it in `license_key.chrome_install_id`.
- Tokens are RS256 JWTs signed with the existing Screenix key (`iss: api.screenix.app`, `aud: screenix-chrome`, `type: chrome-license`, `sub` = license key id, `installId`, 30 days). The extension verifies them with the bundled public key (`src/shared/licensePublicKey.ts`) and its own install ID, refreshes every 12 hours through `POST /api/chrome/license/refresh` (alarm), drops them on 401/403 and allows 7 days offline past expiry.
- Users free a browser from the extension ("Deactivate in this browser" calls `POST /api/chrome/license/deactivate`) or from the dashboard licenses page ("Disconnect"). Both clear `chrome_install_id`.
- License status is shown on the recordings page header (`LicenseStatus`), in the popup, and in the export dialog (watermark or not).
- Website pieces: `lib/chrome-license.ts`, `app/api/chrome/license/{activate,refresh,deactivate}`, `app/chrome/page.tsx`, `components/chrome/`, migration `0050_chrome_license.sql`, optional `STRIPE_CHROME_PRICE_ID` (otherwise an inline $19 price).

## End-to-end check

`bun run test:e2e` builds, loads `dist/` into a temporary headless Chrome profile through `--remote-debugging-pipe` and `Extensions.loadUnpacked` (branded Chrome ignores `--load-extension`), serves `e2e/site`, records with Chrome's fake camera and microphone through two full navigations and an in-page route change, then fails if the screen or camera has a gap or the mic track is missing. Set `CHROME_PATH` to use another Chrome binary.

## Testing without the extension

The editor runs from a static server because it only needs IndexedDB:

1. `bun run build`, then serve `dist/` (for example `python3 -m http.server 8766 --bind 127.0.0.1` in the background).
2. The editor reads the license from `chrome.storage`, so stub `globalThis.chrome` (storage get/set/onChanged, tabs.create) before the app loads, or test license-free code paths only. Then open `http://127.0.0.1:8766/editor.html` in the browser pane and seed a project into IndexedDB `screenix` v1 with a script: a `projects` record, `frames` records (JPEG blobs) and a `pointer` batch.
3. Open `editor.html?project=<id>`. To test exports without downloading files, override `HTMLAnchorElement.prototype.click` to capture the blob, then decode it with a `<video>` element.
4. Delete the test database and stop the server afterwards.

The browser pane uses software encoders and SwiftShader, so GPU-specific bugs do not reproduce there. To inspect a real export from the user, use `ffprobe` / `ffmpeg` on the file in `~/Downloads`.

## Status and next steps

Working and checked by the user: tab recording with tab following, cursor re-rendering, editor, and clean MP4 · AV1 export (30/60/120 fps).

Open:
- Auto-zoom on clicks (deliberately not started; the cursor timeline and click data are ready for it).
- "Share to Screenix" hosted links.
- Chrome Web Store listing and review (debugger permission justification).
- Initial git commit; nothing is committed yet.
- Chrome Web Store link on the success page when the extension isn't installed.
- The macOS Tahoe cursor artwork is GPL-3.0; replace it with owned art before selling the closed extension.
