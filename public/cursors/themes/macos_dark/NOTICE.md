# macos_dark supplemental cursor artwork

Source: https://github.com/ful1e5/apple_cursor/tree/fe044a42b4e9cea16ea762d2ed9004f6d7b35543

Upstream Apple Cursor theme by ful1e5, also used by Screenix’s existing classic macOS cursor assets. See LICENSE for its GPL-3.0 terms.

Preserved the classic macOS geometry and per-cursor hotspots. Resolved the upstream base/outline color tokens to white/black, matching Screenix macOS Dark. Removed baked SVG shadow filters so Screenix controls the shadow. Set output dimensions to 256 pixels; square-padded any non-square viewBox without scaling the geometry. Busy and progress use the first animation frame. Roles sharing an image follow upstream aliases or use an equivalent role from this same theme. No artwork is borrowed from another theme.

| Screenix role | Upstream SVG |
|---|---|
| context-menu | `svg/context-menu.svg` |
| help | `svg/question_arrow.svg` |
| progress | `svg/left_ptr_watch/left_ptr_watch-01.svg` |
| wait | `svg/wait/wait-01.svg` |
| cell | `svg/plus.svg` |
| vertical-text | `svg/vertical-text.svg` |
| alias | `svg/link.svg` |
| copy | `svg/copy.svg` |
| move | `svg/move.svg` |
| no-drop | `svg/dnd_no_drop.svg` |
| not-allowed | `svg/crossed_circle.svg` |
| grab | `svg/hand1.svg` |
| grabbing | `svg/move.svg` |
| e-resize | `svg/left_side.svg` |
| n-resize | `svg/top_side.svg` |
| ne-resize | `svg/bottom_left_corner.svg` |
| nw-resize | `svg/bottom_right_corner.svg` |
| s-resize | `svg/top_side.svg` |
| se-resize | `svg/bottom_right_corner.svg` |
| sw-resize | `svg/bottom_left_corner.svg` |
| w-resize | `svg/left_side.svg` |
| ew-resize | `svg/sb_h_double_arrow.svg` |
| ns-resize | `svg/sb_v_double_arrow.svg` |
| nesw-resize | `svg/bottom_left_corner.svg` |
| nwse-resize | `svg/bottom_right_corner.svg` |
| col-resize | `svg/sb_h_double_arrow.svg` |
| row-resize | `svg/sb_v_double_arrow.svg` |
| all-scroll | `svg/all-scroll.svg` |
| zoom-in | `svg/zoom-in.svg` |
| zoom-out | `svg/zoom-out.svg` |
| dnd-ask | `svg/question_arrow.svg` |
| all-resize | `svg/all-scroll.svg` |
| handwriting | `svg/pencil.svg` |
