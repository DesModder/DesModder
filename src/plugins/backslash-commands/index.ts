import { MathQuillField } from "#components";
import { PluginController } from "#plugins/PluginController.ts";
import "./index.less";

interface PendingCommand {
  mq: MathQuillField;
  command: string;
  cursorIndex: number;
  preview: HTMLElement | undefined;
}

type MathQuillControllerWithLatex = MathQuillField["__controller"] & {
  exportLatex?: () => string;
};

type MathQuillFieldWithLatexWriter = MathQuillField & {
  write?: (latex: string) => unknown;
  cmd?: (latex: string) => unknown;
};

/** On JIS keyboards the same character can be reported as `¥`. */
function isBackslashKey(event: KeyboardEvent) {
  return event.key === "\\" || event.key === "¥";
}

function isModifierKey(key: string) {
  return ["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"].includes(
    key
  );
}

/** Any printable ASCII character can be part of the LaTeX being composed. */
function getLatexInputCharacter(event: KeyboardEvent) {
  // Use the character, not the physical key code. International keyboard
  // layouts can use the same physical key for different shifted characters.
  if (event.key === "\\" || event.key === "¥") return "\\";
  return /^[\x21-\x7e]$/.test(event.key) ? event.key : undefined;
}

/**
 * Adds a LaTeX entry box without patching MathQuill's private `CharCmds`
 * table. The completed contents are parsed by the calculator's MathQuill
 * instance.
 */
export default class BackslashCommands extends PluginController {
  static id = "backslash-commands" as const;
  static enabledByDefault = false;

  private pending: PendingCommand | undefined;

  private clearPending() {
    const preview = this.pending?.preview;
    const cursor = preview?.querySelector(".dcg-mq-cursor");
    if (preview && cursor) preview.replaceWith(cursor);
    else preview?.remove();
    this.pending = undefined;
  }

  /**
   * Desmos uses MathQuill's basic build, which omits LatexCommandInput.
   * Temporarily wrap the live cursor in an equivalent visual node, then put
   * the cursor back before MathQuill handles a completed command.
   */
  private createPreview(mq: MathQuillField) {
    const cursor = mq.el().querySelector(".dcg-mq-cursor");
    if (!(cursor instanceof HTMLElement) || !cursor.parentElement) return;

    const preview = document.createElement("span");
    preview.className = "dsm-latex-command-input";
    preview.setAttribute("aria-hidden", "true");
    cursor.parentElement.insertBefore(preview, cursor);
    preview.addEventListener("mousedown", this.previewMouseDownHandler);
    preview.append(cursor);
    return preview;
  }

  private updatePreview(pending: PendingCommand) {
    const { preview } = pending;
    const cursor = preview?.querySelector(".dcg-mq-cursor");
    if (!preview || !cursor) return;

    const clampedIndex = Math.max(
      0,
      Math.min(pending.cursorIndex, pending.command.length)
    );
    pending.cursorIndex = clampedIndex;
    preview.dataset.cursorIndex = String(clampedIndex);
    preview.replaceChildren();

    const addCharacter = (text: string, index: number) => {
      const char = document.createElement("var");
      char.textContent = text;
      char.dataset.dsmCommandIndex = String(index);
      char.className = "dsm-latex-command-input-char";
      preview.append(char);
    };

    addCharacter("\\", 0);
    if (clampedIndex === 0) preview.append(cursor);
    for (let i = 0; i < pending.command.length; i++) {
      addCharacter(pending.command[i], i + 1);
      if (clampedIndex === i + 1) preview.append(cursor);
    }
  }

  private beginPendingCommand(mq: MathQuillField) {
    const pending: PendingCommand = {
      mq,
      command: "",
      cursorIndex: 0,
      preview: this.createPreview(mq),
    };
    this.pending = pending;
    this.updatePreview(pending);
  }

  private commitPendingCommand(pending: PendingCommand) {
    this.clearPending();
    if (pending.command) this.insertPendingCommand(pending);
  }

  private readonly beforeInputHandler = (event: InputEvent) => {
    if (!this.pending) {
      // Fallback for environments where keydown does not expose the key. Only
      // accept an actual backslash here: `¥` may be committed by an IME.
      if (
        event.isComposing ||
        event.inputType !== "insertText" ||
        event.data !== "\\"
      ) {
        return;
      }
      const mq = this.calc.focusedMathQuill?.mq;
      if (!mq) return;
      event.preventDefault();
      this.beginPendingCommand(mq);
      return;
    }

    // `overrideKeystroke` runs before MathQuill's hidden textarea receives
    // the browser's text input. Suppress that second path while a command is
    // being collected.
    if (
      event.inputType === "insertText" ||
      event.inputType === "deleteContentBackward"
    ) {
      event.preventDefault();
    }
  };

  private readonly keydownHandler = (event: KeyboardEvent) => {
    const result = this.onMQKeystroke(event.key, event);
    if (result === "cancel") event.stopImmediatePropagation();
  };

  private readonly mouseDownHandler = (event: MouseEvent) => {
    const pending = this.getPendingForFocusedMathquill();
    if (!pending) return;

    const { target } = event;
    if (target instanceof Node && pending.preview?.contains(target)) return;
    this.commitPendingCommand(pending);
  };

  private readonly focusOutHandler = (event: FocusEvent) => {
    const { pending } = this;
    const { target } = event;
    if (!(target instanceof Node) || !pending?.mq.el().contains(target)) return;

    queueMicrotask(() => {
      if (this.pending !== pending) return;
      const { activeElement } = document;
      if (
        activeElement instanceof Node &&
        pending.mq.el().contains(activeElement)
      ) {
        return;
      }
      this.commitPendingCommand(pending);
    });
  };

  private readonly previewMouseDownHandler = (event: MouseEvent) => {
    const pending = this.getPendingForFocusedMathquill();
    const { target } = event;
    if (!(target instanceof HTMLElement) || !pending?.preview) return;

    const char = target.closest<HTMLElement>("[data-dsm-command-index]");
    if (!char || !pending.preview.contains(char)) return;
    const index = Number(char.dataset.dsmCommandIndex);
    if (!Number.isInteger(index)) return;

    event.preventDefault();
    event.stopPropagation();
    pending.cursorIndex = index;
    this.updatePreview(pending);
    pending.mq.focus();
  };

  private getPendingForFocusedMathquill() {
    const mq = this.calc.focusedMathQuill?.mq;
    if (!mq || !this.pending || this.pending.mq !== mq) {
      this.clearPending();
      return undefined;
    }
    return this.pending;
  }

  private insertPendingCommand(pending: PendingCommand) {
    const mq = pending.mq as MathQuillFieldWithLatexWriter;
    const controller = pending.mq.__controller as MathQuillControllerWithLatex;
    const latex = `\\${pending.command}`;
    const latexBefore = controller.exportLatex?.() ?? pending.mq.latex();

    // `write()` parses a complete LaTeX fragment, including arguments such
    // as `\\frac{a}{b}`.
    if (typeof mq.write === "function") {
      mq.write(latex);
      const latexAfter = controller.exportLatex?.() ?? pending.mq.latex();
      if (latexAfter !== latexBefore) {
        this.syncFocusedLatex(latexAfter);
        return;
      }
    }

    // In the older MathQuill API, `cmd()` is reliable for a bare command but
    // not for a complete fragment with arguments.
    if (/^[A-Za-z]+$/.test(pending.command) && typeof mq.cmd === "function") {
      mq.cmd(latex);
      this.syncFocusedLatex(controller.exportLatex?.() ?? pending.mq.latex());
    }
  }

  private syncFocusedLatex(latex: string) {
    const item = this.cc.getSelectedItem();
    if (!item) return;
    this.cc.dispatch({ type: "set-item-latex", id: item.id, latex });
  }

  onMQKeystroke(key: string, event: KeyboardEvent): undefined | "cancel" {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
      this.clearPending();
      return;
    }

    const pending = this.getPendingForFocusedMathquill();
    if (!pending) {
      if (!isBackslashKey(event)) return;
      const mq = this.calc.focusedMathQuill?.mq;
      if (!mq) return;
      event.preventDefault();
      this.beginPendingCommand(mq);
      return "cancel";
    }

    // Holding Shift for a capital command name must not commit the command.
    if (isModifierKey(event.key)) return "cancel";

    const latexInputCharacter = getLatexInputCharacter(event);
    if (latexInputCharacter) {
      event.preventDefault();
      pending.command =
        pending.command.slice(0, pending.cursorIndex) +
        latexInputCharacter +
        pending.command.slice(pending.cursorIndex);
      pending.cursorIndex++;
      this.updatePreview(pending);
      return "cancel";
    }

    if (key.endsWith("Left") || event.key === "ArrowLeft") {
      if (pending.cursorIndex === 0) {
        event.preventDefault();
        return "cancel";
      }
      event.preventDefault();
      pending.cursorIndex--;
      this.updatePreview(pending);
      return "cancel";
    }

    if (key.endsWith("Right") || event.key === "ArrowRight") {
      if (pending.cursorIndex === pending.command.length) {
        event.preventDefault();
        return "cancel";
      }
      event.preventDefault();
      pending.cursorIndex++;
      this.updatePreview(pending);
      return "cancel";
    }

    if (key.endsWith("Backspace")) {
      event.preventDefault();
      if (!pending.command) {
        this.clearPending();
        return "cancel";
      }
      if (pending.cursorIndex === 0) return "cancel";
      pending.command =
        pending.command.slice(0, pending.cursorIndex - 1) +
        pending.command.slice(pending.cursorIndex);
      pending.cursorIndex--;
      this.updatePreview(pending);
      return "cancel";
    }
    if (key === "Esc" || key === "Escape") {
      event.preventDefault();
      this.clearPending();
      return "cancel";
    }
    if (!pending.command) {
      this.clearPending();
      pending.mq.typedText("\\");
      return;
    }

    this.commitPendingCommand(pending);

    // These keys commit the entry without inserting an additional delimiter.
    if (key === " " || key === "Spacebar" || key === "Tab" || key === "Enter") {
      event.preventDefault();
      return "cancel";
    }
    if (isBackslashKey(event)) {
      event.preventDefault();
      this.beginPendingCommand(pending.mq);
      return "cancel";
    }
    // Normal delimiters proceed into MathQuill.
  }

  afterEnable() {
    document.addEventListener("keydown", this.keydownHandler, true);
    document.addEventListener("mousedown", this.mouseDownHandler, true);
    document.addEventListener("focusout", this.focusOutHandler, true);
    document.addEventListener("beforeinput", this.beforeInputHandler, true);
  }

  afterDisable() {
    document.removeEventListener("keydown", this.keydownHandler, true);
    document.removeEventListener("mousedown", this.mouseDownHandler, true);
    document.removeEventListener("focusout", this.focusOutHandler, true);
    document.removeEventListener("beforeinput", this.beforeInputHandler, true);
    this.clearPending();
  }
}
