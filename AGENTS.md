# Screenix for Chrome: Agent Notes

Screenix for Chrome is a Manifest V3 extension that records browser tabs without the system cursor, then redraws a smooth cursor in an editor and exports MP4 or WebM. It is open source under the AGPLv3 (`LICENSE`, carve-outs in `NOTICE.md`). Contributions are covered by the CLA in `CLA.md`; read `CONTRIBUTING.md` before opening a pull request.

## Rules

- Keep the code clean, small and idiomatic. Match the surrounding style.
- Do not add code comments. Write clearer code instead.
- Never commit secrets or personal data.
- Do not edit `dist/`, `node_modules/` or the cursor artwork in `public/cursors/`. Generated cursor themes come from `bun run cursors` (see Cursor themes).
- Don't change the brand assets: the Screenix name, logo, `public/icons/` and the images in `.github/` aren't covered by the AGPLv3.
- After changes, run `bun test`, `bun run lint`, `bun run typecheck` and `bun run build`. For changes to capture, recording or Instant mode, also run `bun run test:e2e`.

## Stack

Bun, Vite 7, React 19, TypeScript (strict), Tailwind v4, `@base-ui/react`, `@tabler/icons-react`, `mp4-muxer`, `webm-muxer`, Inter via `@fontsource-variable/inter`.

Two Vite builds:
- `vite.config.ts` builds the extension pages (`editor.html`, `popup.html`, `recorder.html`, setup and permission pages) and the module service worker `background.js`.
- `vite.content.config.ts` builds each content script (`pointer-tracker.js`, `license-bridge.js`, `countdown-overlay.js`) as a self-contained IIFE. They must not share chunks, because they are injected with `chrome.scripting` or listed in the manifest.

Load `dist/` with **Load unpacked** on `chrome://extensions` and press reload on the extension card after each build.

## Layout

| Path | Role |
|---|---|
| `src/shared/screenixOrigin.ts` | `SCREENIX_ORIGIN`, the only place the website address lives. Everything else, including the manifest, derives from it. |
| `src/manifest.ts` | MV3 manifest, emitted as `dist/manifest.json`. Adding a permission shows users a new warning, so avoid it unless there is no other way. |
| `public/_locales/` | Extension name and description per language (they are the Chrome Web Store title, max 75 characters, and summary, max 132). The UI stays English. |
| `src/background/` | Service worker: popup and shortcut messages, recording status in `chrome.storage.session`, the recording session (`recordingSession.ts`), the DevTools screencast (`screencaster.ts`), the countdown and media capture. |
| `src/content/` | Content scripts: pointer tracker, countdown overlay, camera bubble and the license bridge for the website's purchase page. |
| `src/offscreen/` | Offscreen document `recorder.html`: microphone, camera and tab audio capture, and the Instant render worker host. |
| `src/shared/` | Types, settings and defaults (`settings.ts`), IndexedDB layer (`db.ts`), messages, capture settings, license handling. |
| `src/render/` | Drawing: `compositor.ts` draws one output frame (preview, export and Instant all use it), `cursor/` (spring timeline, effects, themes), `zoom/`, `geometry.ts`, `timeMap.ts`, `frameSequence.ts`, browser bar, camera bubble, watermark. |
| `src/export/` | WebCodecs encoder (`encoder.ts`), frame-by-frame export (`exportVideo.ts`), audio mixing and encoding, muxing, share export options. |
| `src/instant/` | Instant mode: renders and encodes the final video in a worker while recording. |
| `src/editor/` | Editor UI: projects page, editor, sidebar tabs (Zoom, Cursor, Camera, Background, Browser, Audio), timeline (trim, zoom, speed and cut lanes), export, share and license dialogs, undo/redo. |
| `src/popup/` | Toolbar popup. It must stay under Chrome's 600 px popup height. |
| `src/share/` | Share-link uploads to Screenix hosted sharing. |
| `e2e/` | End-to-end recording test and its test site. |
| `scripts/cursors/` | Generator for the original cursor themes. |

## Data model

- Times are seconds since recording start. Capture-side epoch milliseconds are converted in the service worker.
- Pointer samples are normalized to the tab viewport (0–1) and carry `tabId`, `kind` (`move` / `down` / `up` / `leave`), `button` (DOM numbering, 0 = left) and `shape`.
- IndexedDB `screenix` stores: `projects`, `frames` (`[projectId, seq]`), `pointer` (batches), `camera`, `audio` (Int16 PCM in 1 s chunks) and `assets` (custom wallpaper, Instant videos).
- Editor settings live on the project record. Times in settings (zoom, speed and cut clips, trim) are recording seconds.

## Decisions and why

- **DevTools screencast, not tabCapture or getDisplayMedia.** Chrome draws the system cursor into tabCapture and getDisplayMedia frames, even when the page hides it. Screencast frames contain only page pixels. The cost is the "started debugging this browser" bar and a damage-driven frame rate (about 30–60 fps).
- **Screencast across navigations.** The screencast keeps running through navigations, and a second `Page.startScreencast` fails with "Screencast is already active", so starting is stop-then-start. `screencaster.ts` also restarts on main-frame navigations and through a watchdog after 1 s without frames.
- **Session exists before tracker injection.** The tracker connects as soon as it is injected; if the service worker has no session yet, it tells the tracker to stop and the tab records no cursor.
- **Debugger bar.** The bar appears a moment after attach and shrinks the page, so the session attaches before the countdown (or waits 0.5 s without one), and frames are drawn top-anchored so the page isn't cropped when the bar appears.
- **Screencast JPEG quality 100.** At q90, small text lost visible detail; q100 is near lossless and the final video is even smaller, because JPEG noise costs encoder bits.
- **Camera encoding runs in a worker.** In the offscreen document `OffscreenCanvas.convertToBlob` takes about 1 s per call (hidden-page throttling), so `cameraEncoderWorker.ts` makes the JPEGs.
- **Export runs on the editor page.** On Windows, Chrome lowers the priority of hidden pages, so export opens a Document Picture-in-Picture window with the progress to keep the process at full priority.
- **Export encoding.** Constant quality (`bitrateMode: "quantizer"`) when supported. The formats are MP4 · H.264 (the default, on the hardware encoder when there is one) and WebM · VP9. AV1 was dropped because it doesn't play on older iPhones and Macs or on sites like X. Chrome's software H.264 has no constant-quality mode and can look slightly blocky on dark pages; the export dialog says so. Share links are always H.264. Export width is aligned to 16 and height to 8.
- **Cursor motion blur is canvas 2D**, accumulating offset copies with `lighter` compositing. A WebGL version produced dark boxes on some GPUs.
- **Cheap compositing.** Background, frame shadow and glass border are cached in one backdrop canvas per size and settings, the cursor shadow uses `shadowBlur` instead of a `drop-shadow` filter (about 22 ms per 1080p frame), and frames and a resting cursor are drawn 1:1 on whole pixels when the size allows.
- **Leaving the page.** A `leave` at the page edge continues the last motion past the edge so the cursor glides out; a return within 1 s keeps one continuous segment, and a longer exit fades.

## Features

- **Cursor themes.** The list is `src/shared/cursorThemes.ts`; `cursor.theme` on the project settings falls back to macOS Tahoe. Third-party themes live in `public/cursors/` with their NOTICE and LICENSE files. The original themes are generated: edit the specs in `scripts/cursors/themes.ts` and run `bun run cursors` (`bun run cursors <path.html>` also writes a comparison gallery).
- **Zoom.** `zoom` is a list of clips `{ id, start, end, scale, mode, centerX, centerY, zoomIn, zoomOut }`. "Auto" follows the cursor with a deadzone spring; "Manual" holds a fixed region. Auto zoom clips come from clicks. `src/render/zoom/zoomTimeline.ts` simulates the camera at 120 Hz once per change, so preview, scrubbing and export get the same frame.
- **Crop.** `crop` is `{ x, y, width, height }` normalized to the recording. The compositor draws the whole frame clipped to the crop, so cursor and effects need no mapping; zoom centres are in cropped space.
- **Ratios without a background** follow the cursor (`src/render/zoom/followTimeline.ts`).
- **Browser frame.** The browser UI is drawn, not recorded (`src/render/browserBar.ts`) from `project.pages`. The address hides the query string and hash unless "Show query and hash" is on, because they can hold tokens.
- **Speed clips and cuts.** `src/render/timeMap.ts` turns trim, cuts and speed clips into the output timeline (`sourceAt`, `outputAt`, `rateAt`). Cursor and camera are always drawn at recording time. Audio keeps its pitch (WSOLA in `src/export/timeStretch.ts`); ranges faster than 4× are silent.
- **Microphone, camera and tab audio.** Choices are in `chrome.storage.local` (`src/shared/captureSettings.ts`). Mic and camera need a one-time grant on `permissions.html`, because the offscreen document can't show prompts. The mic is opened raw (no echo cancellation, noise suppression or auto gain), with the user's gain applied to the samples. Tab audio only works for the tab the recording starts on.
- **Camera bubble on the page.** `camera.html` is web-accessible (with a dynamic URL) and only opens the camera with a per-recording token in `chrome.storage.session`, so websites can't frame it to turn on the camera.
- **Instant mode** renders 60 fps output about 2 s behind live in a worker (`src/instant/liveRender.ts`), skips duplicate frames (at least 10 fps), and zooms on clicks with `LiveZoom`. `LiveCursorTimeline` must stay equivalent to `buildCursorTimeline`; the tests compare them.
- **Countdown.** `countdown-overlay.js` shows the countdown in the page and doubles as warm-up time for the mic and camera. Before it starts, a notice points at the debugger bar and explains that it must stay open and that its Cancel stops the recording; recording waits for Okay, and "Don't show again" turns it off (`debuggerBarNotice` in capture settings). It removes itself before capture starts so it never appears in the video.
- **Recording extension pages.** Chrome never injects content scripts into `chrome-extension://` pages, so extension pages call `trackPointerOnExtensionPage()` (`src/shared/trackExtensionPage.ts`).
- **Licensing and watermark.** Without a license, exports get the "Made with screenix.studio" text watermark (`src/render/watermark.ts`); the preview never shows it. License tokens are RS256 JWTs verified with the bundled public key (`src/shared/licensePublicKey.ts`) and bound to a random install ID. Keep the watermark and license checks intact in contributions.
- **Share links** upload an H.264 MP4 to Screenix hosted sharing with a presigned URL (`src/share/shareVideo.ts`) and need a Screenix plan.

## Tests

- `bun test` runs the unit tests (`*.test.ts` next to the code).
- `bun run test:e2e` builds the extension, loads it into a temporary headless Chrome profile and records once in Studio and once in Instant mode with Chrome's fake camera and microphone, through navigations and a route change. It fails on late starts, gaps in screen or camera frames, a missing mic track, or a slow or wrong-length Instant video. Set `CHROME_PATH` to use another Chrome binary. Headless Chrome has no GPU, so it measures the software path.
- The editor runs from a static server because it only needs IndexedDB: serve `dist/`, stub `globalThis.chrome` (storage, tabs), seed a project into IndexedDB `screenix`, and open `editor.html?project=<id>`.
