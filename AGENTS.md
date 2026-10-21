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
| `src/render/cursor/` | Port of the Screenix editor cursor pipeline: `spring.ts`, `timeline.ts` (120 Hz spring timeline, segments), `cursorState.ts` (click bump, drag squeeze, shape transition, sway, idle fade), `clickEffects.ts`, `cursorPainter.ts`, `theme.ts` (sprite loading per theme; hotspots in `themeHotspots.json`). |
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
- IndexedDB `screenix` stores: `projects`, `frames` (`[projectId, seq]`), `pointer` (batches), `assets` (custom wallpaper).
- Editor settings live on the project record and mirror Screenix defaults: cursor size 6.5% of video width, shadow 0.6, speed 0.5, sway 0.3, motion blur 0.5, screen scale 0.85, corner radius 28, shadow blur 40.

## Decisions and why

- **DevTools screencast, not tabCapture or getDisplayMedia.** Chrome draws the system cursor into tabCapture and getDisplayMedia frames, even when the page hides it. Screencast frames contain only page pixels. The cost is the "started debugging this browser" bar and damage-driven frame rate (about 30–60 fps).
- **Screencast across navigations.** The screencast keeps running through navigations, and a second `Page.startScreencast` fails with "Screencast is already active". Starting is therefore stop-then-start, and following the tab that is already streaming is a no-op. Treating that error as a failure used to drop every frame after the first navigation. `screencaster.ts` also restarts on main-frame navigation events and via a watchdog after 1 s without frames (a restart always emits a frame, so static pages get about 1 fps).
- **Camera encoding runs in a worker.** In the offscreen document `OffscreenCanvas.convertToBlob` takes about 1 s per call (hidden-page task throttling), so `cameraEncoderWorker.ts` makes the JPEGs and writes them; the page only reads frames and hands them over.
- **Session exists before tracker injection.** The tracker connects immediately on injection. If the service worker has no session yet, it tells the tracker to stop, and the first tab records no cursor.
- **Leaving the page.** A `leave` sample is clamped to the edge and appended to the segment. A return within 1 s keeps one continuous segment. A longer exit holds at the edge for 0.35 s, then fades over 0.2 s.
- **Screencast JPEG quality 100.** Measured on a page of small text against a lossless screenshot, q90 frames lost luma detail (40.9 dB) while q100 is near lossless (62.6 dB). Through AV1 q24 that is 40.5 vs 47.9 dB, and the q100 video is smaller because JPEG noise costs encoder bits. Frames are about 1.5–2× bigger in IndexedDB. Color stays limited by 4:2:0 in both the JPEG and the video.
- **Debugger bar resize.** The first frames are taller than later ones because the debugger bar appears after attach. With a background on, frames within 15% of the video aspect cover the video, top-anchored, instead of letterboxing.
- **Cursor motion blur is canvas 2D.** It accumulates 2–21 offset copies with `lighter` compositing, the same math as the Screenix WebGL shader. The WebGL version produced dark boxes in exports on the user's GPU.
- **Cheap compositing.** The cursor shadow uses `shadowBlur` at twice the old `drop-shadow` radius (pixel-identical); the `drop-shadow` filter cost about 22 ms per 1080p frame. The background, frame shadow and glass border are cached in one backdrop canvas per size and settings. Without a background, frames within 1% of the video size are drawn 1:1 at integer offsets instead of being resampled. A resting cursor (no motion, sway or scaling, untransformed canvas) whose sprite is within 2% of the drawn size is drawn at the sprite's own size on whole pixels; drawing it at a sub-pixel position and a 0.2% scale softened its outline.
- **Export encoding.** Constant quality (`bitrateMode: "quantizer"`) when supported. MP4 · AV1 at q24 is the default. Chrome's software H.264 (OpenH264) has no quantizer mode and undershoots its bitrate badly on dark pages, leaving blocky trails, so the dialog warns about it. Export width is aligned to 16 and height to 8.
- **Cursor themes** come from the Screenix desktop app (`ui/public/cursors/themes`, hotspots from `ui/src/lib/wayland-cursor-shapes.json`): macOS Tahoe (`public/cursors/*.svg`), macOS Dark, Mochi, AOSP, Mocu, Kenney and Mint (`public/cursors/themes/<id>/`, each with its NOTICE/LICENSE). The list is `src/shared/cursorThemes.ts`; `cursor.theme` is on the project settings and unknown values fall back to macOS Tahoe. macOS Dark uses the desktop's 128 px PNGs for the four base shapes.
- **Wallpapers** are fetched from the Screenix CDN (`cdn.usearctic.sh`). Host permissions bypass CORS inside the extension. Plain localhost test pages fall back to the solid color.

## Microphone, camera and tab audio

- Choices live in `chrome.storage.local` (`src/shared/captureSettings.ts`) and are set in the popup (`src/popup/MediaControls.tsx`). Mic and camera need a one-time grant on the extension origin: `permissions.html` (`src/permissions/`) asks for it on a visible tab, because the offscreen document can't show prompts.
- Capture runs in an offscreen document, `recorder.html` (`src/offscreen/`), created by `src/background/mediaCapture.ts` with reasons `USER_MEDIA` and `AUDIO_PLAYBACK`. Media starts before the screencast, and a failure aborts the recording start.
- Tab audio uses `chrome.tabCapture.getMediaStreamId` for the tab the recording starts on. Chrome only allows this for a tab the extension was invoked on, so other tabs' sound isn't captured. The offscreen page routes the captured audio back to the speakers, because tab capture mutes the tab.
- The mic is opened raw (`echoCancellation`, `noiseSuppression` and `autoGainControl` off): Chrome's call-oriented processing clipped speech onsets. Audio packets are placed by their timestamps and gaps are filled with silence so tracks never drift.
- Audio is stored as interleaved Int16 PCM in 1 s chunks (`audio` store), with `startT`, sample rate and channel count on the project (`audioTracks`). Camera frames are JPEGs at up to 30 fps and 540 px tall (`camera` store, same shape as screen frames, `project.camera`). The camera recorder only waits for the JPEG encode before taking the next frame; database writes are queued, because waiting on them dropped frames whenever the screen recording kept IndexedDB busy.
- Editor: `src/render/audioTracks.ts` loads tracks into `AudioBuffer`s; `src/editor/playback/AudioPlayer.ts` plays them in sync with `PlaybackClock` (resyncs past 150 ms drift). The camera bubble is drawn by `src/render/cameraBubble.ts` through the compositor. The Camera panel can import a video file as the camera track (`src/editor/lib/importCameraVideo.ts`): it seeks through the video at 30 fps, stores 540p JPEGs in the `camera` store like a live recording, loops shorter videos by reusing frames, then reloads the editor. Settings: `camera` (`x`/`y` from 0 to 1 across the free space inside the margin, size, roundness, squircle, shadow, mirror, glass border rim; defaults 24% size, 90% roundness, bottom right). The sidebar corners just set `x`/`y`; dragging the bubble in the preview (`src/editor/components/preview/useCameraDrag.ts`) places it anywhere, coalesced into one undo step, and a drag never toggles playback and `audio` (per-track volume, 0–200%).
- Export: `src/export/audioMixer.ts` mixes tracks to 48 kHz stereo; `src/export/audioEncoding.ts` encodes AAC when available, otherwise Opus (WebM always Opus); `src/export/muxer.ts` builds the MP4/WebM with both tracks. Audio blocks are encoded right after each video frame so the muxers get interleaved chunks.

## Licensing and watermark

- Free use is unlimited. Exports without a license get the Screenix watermark (`public/watermark.png`, copied from `src-tauri/ressources/watermark.png`): height 12% of the output, centered, 5% above the bottom, drawn on the whole frame in `src/render/watermark.ts`. The preview never shows it, same as the desktop app.
- Licenses are Screenix license keys (`SCRX-…`), one key per browser. Chrome keys use `license_key.tier = "chrome"` ($19 lifetime each, any quantity). A desktop yearly/lifetime/team key can also activate one browser. Chrome keys are rejected by the desktop activation and verification routes.
- Buying: "Remove watermark" opens `${SCREENIX_ORIGIN}/chrome/pricing` (pricing page with a quantity picker; `/chrome` is reserved for the landing page). Checkout (`plan: "chrome"`) needs no login and pre-fills the email when signed in. The Stripe webhook reuses the lifetime branch: it finds or creates the account by email, creates the keys and emails them, without changing the account's desktop tier. Stripe returns to `/purchase/success`, which shows the keys with an "Activate in this browser" button.
- Activating: the success-page button talks to `src/content/licenseBridge.ts` (injected on `/purchase/success*`) via `window.postMessage`. The extension's "Have a license key?" dialog (`src/editor/components/LicenseDialog.tsx`, also reachable from the popup via `editor.html?license=1`; when licensed it shows the account, key ending, "Manage licenses" and "Deactivate in this browser") takes a pasted key. Both call `POST /api/chrome/license/activate` with `{ licenseKey, installId }`. `installId` is a random ID kept in `chrome.storage.local`; the key is bound to it in `license_key.chrome_install_id`.
- Tokens are RS256 JWTs signed with the existing Screenix key (`iss: api.screenix.app`, `aud: screenix-chrome`, `type: chrome-license`, `sub` = license key id, `installId`, 30 days). The extension verifies them with the bundled public key (`src/shared/licensePublicKey.ts`) and its own install ID, refreshes every 12 hours through `POST /api/chrome/license/refresh` (alarm), drops them on 401/403 and allows 7 days offline past expiry.
- Users free a browser from the extension ("Deactivate in this browser" calls `POST /api/chrome/license/deactivate`) or from the dashboard licenses page ("Disconnect"). Both clear `chrome_install_id`.
- License status is shown on the recordings page header (`LicenseStatus`), in the popup, and in the export dialog (watermark or not).
- Website pieces: `lib/chrome-license.ts`, `app/api/chrome/license/{activate,refresh,deactivate}`, `app/chrome/page.tsx`, `components/chrome/`, migration `0050_chrome_license.sql`, optional `STRIPE_CHROME_PRICE_ID` (otherwise an inline $19 price).

## Zoom

- Ported from the Screenix desktop editor (`ui/src/lib/zoomCameraEngine.ts`, click ranges in `ui/src/lib/recordingZoom.ts`). Settings: `zoom` is a list of `{ id, start, end, scale, mode, centerX, centerY, zoomIn, zoomOut }` in recording seconds (scale 1–4×, transitions 0.1–2 s). Zoom-in runs inside the clip, zoom-out after its end, both capped at half the clip length.
- Two modes. "Auto" (`mode: "auto"`) is the desktop's deadzone mode: cursor positions are grouped into buckets the size of half the visible area, and a spring pans to the next bucket when the cursor leaves it. "Manual" (`mode: "manual"`) is the desktop's `static_region`: a fixed area, with a 1 s pan between manual clips less than 1.5 s apart. The desktop's Auto is the same deadzone mode with the same defaults; its Follow mode is not ported.
- New clips (Add zoom: 1.5 s at the playhead, 1.5×) and click-generated clips are both Auto. Auto zoom uses the same click ranges as the desktop (600 ms before each click to 2.2 s after, merged when less than 1.8 s apart, ending 0.6 s before the end, clicks in the last 0.9 s ignored) and replaces all zoom clips. Projects whose settings have no `zoom` field get these clips when the editor opens.
- `src/render/zoom/zoomTimeline.ts` simulates the camera at 120 Hz once per change, only inside clip windows, so preview, scrubbing and export get the same frame. With a background, "Zoom inside frame" (`background.zoomInsideFrame`, off by default, in the Background panel like the desktop's `floatingZoomContentOnly`) chooses how zoom is drawn: off zooms the whole scene (background, frame, shadow, screen and cursor) so the zoomed area fills the frame's place; on keeps the frame fixed and zooms only its content. The camera bubble is never zoomed. Canvas shadows and filters ignore the transform, so the frame shadow and glass blur are scaled by the current transform.
- UI: Zoom sidebar tab (`ZoomPanel`, with a region picker on the project thumbnail for Manual), a zoom lane above the speed lane (`ClipLane`, shared with speed clips; overlap and trim rules in `src/editor/lib/clipSpans.ts`), and Add zoom in the timeline toolbar. Selecting a zoom clip opens the Zoom tab; Delete removes it.

## Crop

- Settings: `crop` is `{ x, y, width, height }` normalized to the recording (`FULL_CROP` when uncropped). `croppedSize` replaces the source size for the video rect and every aspect (`outputAspect`: preview, export, thumbnail, Ratio panel); the compositor draws the whole frame at `uncroppedRect(video, crop)` clipped to the video, so cursor and click effects need no mapping. Zoom centres are in visible space, so `useSceneInputs` maps cursor points into crop space before building the zoom timeline, and the manual region picker shows only the cropped part of the thumbnail.
- UI: Crop in the timeline toolbar (it reads "Edit crop" once cropped) switches the preview to the full recording without background, camera or zoom, with a drag box (`CropOverlay`, logic in `src/editor/lib/cropRect.ts`). Done, Enter or Escape leaves crop mode; Reset restores the full frame.

## Speed clips

- Settings: `speed` is a list of `{ id, start, end, rate }` in recording seconds (rate 0.25–16×), like the Screenix desktop app's speed clips. Editing helpers (add at the playhead as 2 s at 2×, move, resize, rate, delete; no overlaps, kept inside the trim) live in `src/editor/lib/speedClips.ts`; the timeline shows them in a lane under the clip (`SpeedLane`, `SpeedControls`).
- `src/render/timeMap.ts` turns trim plus speed clips into an output timeline (`sourceAt`, `outputAt`, `rateAt`, `outputDuration`). The playback clock runs on output time and reports recording time, export renders frame `i` at `sourceAt(i / fps)`, and share uploads use `outputDuration`. Cursor and camera are always drawn at recording time, so they follow the speed automatically.
- Audio keeps its pitch: preview plays each track through an `<audio>` element (WAV made from the decoded buffer, `preservesPitch`) whose `playbackRate` follows `rateAt`; export builds each track along the output timeline and time-stretches sped segments with WSOLA (`src/export/timeStretch.ts`). Ranges faster than `MAX_AUDIBLE_RATE` (4×) are silent in both, since Chrome mutes media elements above 4× anyway.

## Instant mode

- The popup switches between Studio and Instant (`mode` and `instantLook` in `captureSettings`). Looks: "Edge to edge" (no background) or "With background" (default wallpaper and frame). Instant uses the default Studio cursor (smooth spring, sway, motion blur, shadow) and no zoom; its settings are saved on the project, so "Edit in Studio" opens the same look.
- The video is rendered while recording. The offscreen document (reason `WORKERS`) starts `src/instant/instantRenderWorker.ts` through `src/offscreen/instantRecorder.ts`. `LiveRender` (`src/instant/liveRender.ts`) polls IndexedDB for new frames, camera frames and pointer batches every 200 ms, gets audio chunks straight from the audio recorders, and renders 60 fps output about 2 s behind live through the shared `Compositor`, then encodes with `VideoFileEncoder` (hardware H.264, then AV1, then software H.264; audio AAC or Opus).
- `LiveCursorTimeline` builds the same cursor timeline as `buildCursorTimeline` incrementally (tests compare them). The spring target only looks 0.25 s ahead, so a resting pointer holds still instead of drifting toward the next sample; leave/return decisions need 1 s, hence the render lag. `LiveAudioMixer` mixes tracks as chunks arrive.
- Speed and sharpness: in Instant mode HiDPI screens are captured at 1920 px on the long side, but never below one pixel per CSS pixel (downscaling 1× text made it blurry), so a 2560×1440 monitor records at 2560. Output is the frame size aligned down (frames are copied 1:1, up to 3840), encoders run in `realtime` latency mode (exports keep `quality`), frames identical to the previous one are skipped (variable frame rate, at least one frame per second), and when the renderer falls more than 1 s behind it renders every other frame until it catches up. Cursor sprites are rasterized at the exact output size in the offscreen page (workers can't decode SVG) and transferred to the worker.
- On stop the service worker saves the project, opens `editor.html?instant=<id>` (`InstantPage`) and sends `instant/finish`; the worker renders the last seconds and stores the MP4 and a poster in the `assets` store (`instant-video`, `instant-poster`). Progress and the result are in `chrome.storage.session` (`instantStatus`). The page plays the video and offers Get share link / Copy link (uploads the MP4 as is), Download MP4, Edit in Studio and Delete. The recording status stays `saving` until the render finishes.
- Zoom on clicks (`instantZoom` in `captureSettings`, off by default, a switch in the popup under the look) is `LiveZoom` (`src/instant/liveZoom.ts`), a camera stepped at 120 Hz as frames render rather than a precomputed timeline. It reads the live cursor timeline's clicks and pointer, which are known `POINTER_LOOKAHEAD` ahead of the render: zoom-in to 1.5× starts 0.45 s before a click and lands on it (`easeInOutCubic`). Zooms run about the fixed point of the final view with the scale eased in log space, so the picture only grows (or shrinks) around that point; easing the centre and scale separately, as `compose` does, made the clicked spot drift outward and back. The view holds 2.2 s after the last click and stays zoomed if another click is known within 0.9 s, pans with the studio deadzone spring when the cursor or the next click leaves the inner 70%, and zooms out over 0.7 s (`easeOutCubic`). Clicks in the last 1.6 s are ignored and the view is out 1 s before the end. Fixed-length transitions keep the number of changed frames low, since a zoomed or moving view defeats duplicate-frame skipping. Cursor sprites are also rasterized at 1.5× (`zoomSprites`) so the zoomed cursor stays sharp. The saved project gets the studio auto zoom clips (`autoZoomClips`, from clicks collected in the service worker), so Edit in Studio keeps the zoom.
- The watermark is decided when recording starts. The whole MP4 is kept in memory until it's finished, like exports.

## Recording extension pages

Chrome never injects content scripts into `chrome-extension://` pages, including our own editor. The tracker lives in `src/content/pointerTracking.ts`; the content-script entry `src/content/pointerTracker.ts` just calls it, and extension pages call `trackPointerOnExtensionPage()` (`src/shared/trackExtensionPage.ts`, used by the editor and permissions entries), which connects the same tracker whenever the recording status in `chrome.storage.session` becomes `recording`.

## Share links

- Links use Screenix hosted sharing and the same `/s/[id]` page as the desktop app. Sharing needs a license whose Screenix account has a sharing plan (yearly, team or an active trial); a $19 Chrome key alone exports without a watermark but can't share.
- Flow (`src/share/shareVideo.ts`): `POST /api/chrome/share/check` before exporting so users without a plan don't wait for an export, then `create-upload` with the license token as Bearer, a single presigned `PUT` of the MP4 straight to R2 (works because of `<all_urls>`), an optional JPEG thumbnail rendered by `src/export/thumbnail.ts`, then `confirm`. WebM can't be shared.
- UI: the editor top bar has Share (`ShareDialog`), and the export dialog has "Get share link" (`useShareLink`, `ShareStatus`). Share checks the plan, reuses the last clean MP4 export when the edits haven't changed (`src/editor/lib/exportCache.ts`, in memory only) or exports at 1080p60 (`src/export/shareOptions.ts`, AV1 then H.264), uploads, and returns the same link again for the same export. The link is copied to the clipboard and saved on the project (`ProjectRecord.share`), so after a refresh the top bar shows Shared, which opens `ManageShareDialog` to edit the title and description, copy or open the link, or delete it (`/api/chrome/share/{get,update,delete}`, which only need a valid license, not an active plan). A link deleted on the website is detected when the dialog opens and cleared from the project.
- On the website, Chrome shares are rows in `shared_video` with `source = 'chrome'`; the desktop share list only returns `source = 'desktop'` rows. Upload and confirm logic is shared with the desktop routes (`lib/hosted-share-upload.ts`, `lib/hosted-share-confirm.ts`).

## End-to-end check

`bun run test:e2e` builds, loads `dist/` into a temporary headless Chrome profile (1920×1200 screen) through `--remote-debugging-pipe` and `Extensions.loadUnpacked` (branded Chrome ignores `--load-extension`), serves `e2e/site`, and records once in Studio and once in Instant mode with Chrome's fake camera and microphone, moving the mouse with real input events, through two full navigations and an in-page route change. It fails if the screen or camera has a gap, the mic track is missing, or the instant video isn't ready within 10 s of stopping or has the wrong length. Set `CHROME_PATH` to use another Chrome binary and `INSTANT_VIDEO_PATH` to keep the instant MP4. Headless Chrome has no GPU or hardware encoder, so it measures the slowest path (software AV1, CPU canvas).

## Testing without the extension

The editor runs from a static server because it only needs IndexedDB:

1. `bun run build`, then serve `dist/` (for example `python3 -m http.server 8766 --bind 127.0.0.1` in the background).
2. The editor reads the license from `chrome.storage`, so stub `globalThis.chrome` (storage local/session get/set/onChanged, tabs.create) before the app loads, or test license-free code paths only. Then open `http://127.0.0.1:8766/editor.html` in the browser pane and seed a project into IndexedDB `screenix` (open it without a version once the app has created it) with a script: a `projects` record, `frames` records (JPEG blobs) and a `pointer` batch.
3. Open `editor.html?project=<id>`. To test exports without downloading files, override `HTMLAnchorElement.prototype.click` to capture the blob, then decode it with a `<video>` element.
4. Delete the test database and stop the server afterwards.

The browser pane uses software encoders and SwiftShader, so GPU-specific bugs do not reproduce there. To inspect a real export from the user, use `ffprobe` / `ffmpeg` on the file in `~/Downloads`.

## Status and next steps

Working and checked by the user: tab recording with tab following, cursor re-rendering, editor, and clean MP4 · AV1 export (30/60/120 fps).

Open:
- "Share to Screenix" hosted links.
- Chrome Web Store listing and review (debugger permission justification).
- Initial git commit; nothing is committed yet.
- Chrome Web Store link on the success page when the extension isn't installed.
- The macOS Tahoe and macOS Dark cursor artwork is GPL-3.0; replace it with owned art before selling the closed extension.
