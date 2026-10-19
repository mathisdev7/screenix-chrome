export const CURSOR_SHAPES = [
  "default",
  "text",
  "hand",
  "crosshair",
  "context-menu",
  "help",
  "progress",
  "wait",
  "cell",
  "vertical-text",
  "alias",
  "copy",
  "move",
  "no-drop",
  "not-allowed",
  "grab",
  "grabbing",
  "e-resize",
  "n-resize",
  "ne-resize",
  "nw-resize",
  "s-resize",
  "se-resize",
  "sw-resize",
  "w-resize",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "col-resize",
  "row-resize",
  "all-scroll",
  "zoom-in",
  "zoom-out",
] as const;

export type CursorShape = (typeof CURSOR_SHAPES)[number];

const CSS_KEYWORD_SHAPES: Record<string, CursorShape> = {
  pointer: "hand",
  "-webkit-grab": "grab",
  "-webkit-grabbing": "grabbing",
  "-webkit-zoom-in": "zoom-in",
  "-webkit-zoom-out": "zoom-out",
};

const KNOWN_SHAPES = new Set<string>(CURSOR_SHAPES);

export function cursorShapeForCssKeyword(keyword: string): CursorShape | null {
  if (keyword in CSS_KEYWORD_SHAPES) return CSS_KEYWORD_SHAPES[keyword];
  return KNOWN_SHAPES.has(keyword) ? (keyword as CursorShape) : null;
}
