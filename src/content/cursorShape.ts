import { cursorShapeForCssKeyword, type CursorShape } from "@/shared/cursorShapes";

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

function pointIsOnText(x: number, y: number): boolean {
  const node = document.caretRangeFromPoint?.(x, y)?.startContainer;
  if (node?.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
  const range = document.createRange();
  range.selectNodeContents(node);
  return Array.from(range.getClientRects()).some(
    (rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
  );
}

function autoCursorShape(element: Element, x: number, y: number): CursorShape {
  if (element instanceof HTMLTextAreaElement) return "text";
  if (element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)) return "text";
  if (element instanceof HTMLElement && element.isContentEditable) return "text";
  return pointIsOnText(x, y) ? "text" : "default";
}

export function cursorShapeAt(target: EventTarget | null, x: number, y: number): CursorShape {
  if (!(target instanceof Element)) return "default";
  const keyword = getComputedStyle(target).cursor.split(",").pop()?.trim() ?? "auto";
  if (keyword === "auto") return autoCursorShape(target, x, y);
  return cursorShapeForCssKeyword(keyword) ?? "default";
}
