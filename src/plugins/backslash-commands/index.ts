import { MathQuillField } from "#components";
import { PluginController } from "#plugins/PluginController.ts";
import "./index.less";

interface PendingCommand {
  mq: MathQuillField;
  command: string;
  cursorIndex: number;
  preview: HTMLElement | undefined;
  sourceElement: HTMLElement | undefined;
}

type MathQuillFieldWithLatexWriter = MathQuillField & {
  write?: (latex: string) => unknown;
};

const nonCommittingKeyNames = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "AltGraph",
  "CapsLock",
  "Dead",
  "Process",
  "Unidentified",
  "Backspace",
]);

/**
 * Adds a LaTeX entry box without patching MathQuill's private `CharCmds`
 * table. The completed contents are parsed by the calculator's MathQuill
 * instance.
 */
export default class BackslashCommands extends PluginController {
  static id = "backslash-commands" as const;
  static enabledByDefault = false;

  private pending: PendingCommand | undefined;
  private isEnabled = false;

  private clearPending() {
    this.pending?.sourceElement?.classList.remove(
      "dsm-latex-command-input-active"
    );
    this.pending?.preview?.remove();
    this.pending = undefined;
  }

  /**
   * Desmos uses MathQuill's basic build, which omits LatexCommandInput.
   * Place an equivalent visual node next to the live cursor instead. The
   * preview owns a fake caret; the MathQuill cursor remains in its original
   * DOM position so repeated input cannot disturb MathQuill's internals.
   */
  private createPreview(mq: MathQuillField) {
    const sourceElement = mq.el();
    const cursor = sourceElement.querySelector(".dcg-mq-cursor");
    if (!(cursor instanceof HTMLElement) || !cursor.parentElement) return;

    const preview = document.createElement("span");
    preview.className = "dsm-latex-command-input";
    preview.setAttribute("aria-hidden", "true");
    cursor.parentElement.insertBefore(preview, cursor);
    preview.addEventListener("mousedown", this.previewMouseDownHandler);
    sourceElement.classList.add("dsm-latex-command-input-active");
    return { preview, sourceElement };
  }

  private updatePreview(pending: PendingCommand) {
    const { preview } = pending;
    if (!preview) return;

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

    const addCaret = () => {
      const caret = document.createElement("span");
      caret.className = "dsm-latex-command-input-caret";
      preview.append(caret);
    };

    addCharacter("\\", 0);
    if (clampedIndex === 0) addCaret();
    for (let i = 0; i < pending.command.length; i++) {
      addCharacter(pending.command[i], i + 1);
      if (clampedIndex === i + 1) addCaret();
    }
  }

  private beginPendingCommand(mq: MathQuillField) {
    const previewInfo = this.createPreview(mq);
    const pending: PendingCommand = {
      mq,
      command: "",
      cursorIndex: 0,
      preview: previewInfo?.preview,
      sourceElement: previewInfo?.sourceElement,
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

    if (event.isComposing) {
      this.clearPending();
      return;
    }

    if (event.inputType === "insertText") {
      const { data } = event;
      if (!data || !/^[\x20-\x7e]+$/.test(data)) {
        this.commitPendingCommand(this.pending);
        return;
      }

      event.preventDefault();
      this.pending.command =
        this.pending.command.slice(0, this.pending.cursorIndex) +
        data +
        this.pending.command.slice(this.pending.cursorIndex);
      this.pending.cursorIndex += data.length;
      this.updatePreview(this.pending);
      return;
    }

    if (event.inputType === "deleteContentBackward") {
      event.preventDefault();
      if (!this.pending.command) {
        this.clearPending();
        return;
      }
      if (this.pending.cursorIndex === 0) return;
      this.pending.command =
        this.pending.command.slice(0, this.pending.cursorIndex - 1) +
        this.pending.command.slice(this.pending.cursorIndex);
      this.pending.cursorIndex--;
      this.updatePreview(this.pending);
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
    const latex = `\\${pending.command}`;
    const latexBefore = pending.mq.latex();

    // `write()` accepts complete LaTeX fragments, such as `\\frac{a}{b}`.
    if (typeof mq.write === "function") {
      mq.write(latex);
      const latexAfter = pending.mq.latex();
      if (latexAfter !== latexBefore) {
        this.syncFocusedLatex(latexAfter);
      }
    }
  }

  private syncFocusedLatex(latex: string) {
    const item = this.cc.getSelectedItem();
    if (!item) return;
    this.cc.dispatch({ type: "set-item-latex", id: item.id, latex });
  }

  onMQKeystroke(key: string, event: KeyboardEvent): undefined | "cancel" {
    if (event.isComposing) {
      this.clearPending();
      return;
    }

    const pending = this.getPendingForFocusedMathquill();
    if (!pending) {
      return;
    }

    // These keys are either modifiers or handled later by `beforeinput`.
    if (event.key.length === 1 || nonCommittingKeyNames.has(event.key)) {
      return "cancel";
    }

    if (key === "ArrowLeft") {
      if (pending.cursorIndex === 0) {
        event.preventDefault();
        return "cancel";
      }
      event.preventDefault();
      pending.cursorIndex--;
      this.updatePreview(pending);
      return "cancel";
    }

    if (key === "ArrowRight") {
      if (pending.cursorIndex === pending.command.length) {
        event.preventDefault();
        return "cancel";
      }
      event.preventDefault();
      pending.cursorIndex++;
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
    if (key === "Tab" || key === "Enter") {
      event.preventDefault();
      return "cancel";
    }
  }

  afterEnable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    document.addEventListener("keydown", this.keydownHandler, true);
    document.addEventListener("mousedown", this.mouseDownHandler, true);
    document.addEventListener("focusout", this.focusOutHandler, true);
    document.addEventListener("beforeinput", this.beforeInputHandler, true);
  }

  afterDisable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    document.removeEventListener("keydown", this.keydownHandler, true);
    document.removeEventListener("mousedown", this.mouseDownHandler, true);
    document.removeEventListener("focusout", this.focusOutHandler, true);
    document.removeEventListener("beforeinput", this.beforeInputHandler, true);
    this.clearPending();
  }
}
