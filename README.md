# Screenix for Chrome

Record a browser tab and get the smooth, re-rendered cursor from [Screenix](https://screenix.studio), right in Chrome.

Most browser recorders bake the system cursor into the video. Screenix for Chrome records the page without it, tracks the pointer separately, and redraws it in the editor: spring-smoothed motion, motion blur, sway, click feedback and a crisp macOS cursor at any size.

## Features

- **Tab recording that follows you.** Switch tabs or navigate while recording and the recording follows the active tab of the window you started in.
- **Re-rendered cursor.** The same cursor pipeline as the Screenix desktop app: spring smoothing (with stiffer springs around clicks and drags), motion blur, sway, click bump, drag squeeze, shape-change transitions, idle hiding and click effects (ripple, highlight, halo, burst).
- **Microphone, camera and tab audio.** Record your voice and webcam alongside the tab, then adjust volumes and the camera bubble in the editor.
- **Editor.** Background (wallpaper, color or gradient), screen scale, squircle corners, shadow, glass border, output aspect ratio, and trimming.
- **Frame-accurate export.** Every frame is rendered at a steady 30 or 60 fps and encoded with WebCodecs at constant quality: MP4 · AV1 (default, cleanest), MP4 · H.264 (most compatible) or WebM · VP9, with a software or GPU encoder.

## How it works

| Piece | Where |
|---|---|
| Capture | `src/background/` attaches the Chrome DevTools Protocol to the active tab and uses `Page.startScreencast`. Screencast frames contain only what the page draws, so the system cursor is never in them. |
| Pointer tracking | `src/content/pointerTracker.ts` records pointer position, buttons and the CSS cursor shape under the pointer. |
| Storage | Frames and pointer samples are written to IndexedDB as they arrive (`src/shared/db.ts`). |
| Cursor | `src/render/cursor/` is a port of the Screenix editor's cursor timeline and effects, with its motion blur redone in plain canvas 2D. |
| Rendering | `src/render/compositor.ts` draws one output frame. The preview and the export both use it, so what you see is what you export. |
| Export | `src/export/` renders frames off-screen, encodes them with WebCodecs in constant-quality mode when the browser supports it, and muxes them with `mp4-muxer` / `webm-muxer`. Chrome's software H.264 encoder has no constant-quality mode and undershoots its bitrate on dark pages, which is why AV1 is the default. |

Because capture uses the debugger API, Chrome shows a "started debugging this browser" bar while recording. Pages Chrome protects (the new tab page, `chrome://` pages, the Web Store) can't be recorded. The last captured frame holds while one of them is active.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select the `dist` folder. Rebuild and press the reload button on the extension card after changes.

```bash
bun test
bun run test:e2e
bun run lint
bun run typecheck
```

## License

Proprietary. Copyright (c) 2026 Screenix. All rights reserved. See [LICENSE](LICENSE).

The cursor artwork in `public/cursors` is third-party and licensed separately; see `public/cursors/NOTICE.md`. Wallpapers are loaded from the Screenix CDN and are Unsplash photos.
