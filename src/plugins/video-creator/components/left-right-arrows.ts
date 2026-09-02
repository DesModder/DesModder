import { MathQuillView } from "../../../components/desmosComponents.ts";

/**
 * If left/right is pressed, move to the next inline math input view
 * which is a child of `parent`. Returns true if handled.
 */
export function leftRightArrows(
  parent: HTMLElement,
  key: string,
  evt: KeyboardEvent
): boolean {
  if (!document.activeElement) return false;
  if (evt.shiftKey || evt.altKey || evt.metaKey || evt.ctrlKey) return false;

  const dir = key === "Left" ? -1 : key === "Right" ? 1 : undefined;
  if (dir === undefined) return false;

  const fields: HTMLElement[] = Array.from(
    // Need to specify specifically textareas in editable fields
    // because placeholders are treated as a separate static mathquill field.
    parent.querySelectorAll(
      ".dcg-inline-math-input-view .dcg-mq-editable-field textarea"
    )
  );
  const focusedIndex = (fields as Element[]).indexOf(document.activeElement);

  if (focusedIndex === -1) return false;

  const mq = MathQuillView.getFocusedMathquill();
  if (!mq) return false;

  evt.stopPropagation();
  evt.preventDefault();

  const atBounds = MathQuillView.applyArrowKeyAndReturnIfWasAtBounds(
    mq,
    key,
    evt
  );
  if (!atBounds) return true;

  const newIndex = focusedIndex + dir;

  if (newIndex < 0 || newIndex >= fields.length) return true;

  fields[newIndex].focus();
  return true;
}
