import { DCGView } from "#DCGView";
import { Inserter, PluginController } from "../PluginController";
import { TextModeToggle } from "./components/TextModeToggle";
import { TextModeEditor } from "#text-mode-editor";

export default class TextMode extends PluginController {
  static id = "text-mode" as const;
  static enabledByDefault = false;
  static descriptionLearnMore = "https://www.desmodder.com/text-mode";
  editor: TextModeEditor | undefined;
  inTextMode = false;

  updateDebugMode() {
    this.editor?.setDebugMode(this.dsm.isPluginEnabled("debug-mode"));
  }

  afterDisable() {
    if (this.inTextMode) this.toggleTextMode();
  }

  toggleTextMode() {
    // Actual initialization is all handled in didMount and willUnmount
    this.inTextMode = !this.inTextMode;
    this.cc.updateViews();
  }

  didMount(div: HTMLElement) {
    this.editor = new TextModeEditor({
      calc: this.calc,
      parent: div,
      conversionErrorUndo: () => this.toggleTextMode(),
    });
    this.updateDebugMode();
    this.cc.expressionSearchOpen = false;
    // Ticks update rendering, and they process sliders. Since the existing
    // expression UI doesn't render in text mode, we replace markTickRequiredNextFrame
    // with a version that calls markTickRequiredNextFrame only when sliders are playing
    this.cc.markTickRequiredNextFrame = function () {
      if (this.getPlayingSliders().length > 0) {
        // eslint-disable-next-line no-proto
        (this as any).__proto__.markTickRequiredNextFrame.apply(this);
      }
    };
  }

  willUnmount() {
    // Revert back to the old markTickRequiredNextFrame given by prototype
    delete (this.cc as any).markTickRequiredNextFrame;
    if (this.editor) {
      this.editor.dispose();
      this.editor = undefined;
    }
  }

  editorPanel(): Inserter {
    if (!this.inTextMode) return undefined;
    return () =>
      DCGView.createElement("div", {
        class: DCGView.const("dsm-text-editor-container"),
        didMount: this.didMount.bind(this),
        willUnmount: this.willUnmount.bind(this),
      });
  }

  textModeToggle(): Inserter {
    if (this.cc.isInEditListMode()) return undefined;
    return () => TextModeToggle(this);
  }
}
