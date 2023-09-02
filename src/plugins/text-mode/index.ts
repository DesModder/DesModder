import { DCGView } from "#DCGView";
import { Inserter, PluginController } from "../PluginController";
import { TextModeToggle } from "./components/TextModeToggle";
import { TextModeEditor } from "#text-mode-editor";

export default class TextMode extends PluginController {
  static id = "text-mode" as const;
  static enabledByDefault = false;
  static descriptionLearnMore = "https://www.desmodder.com/text-mode";
  editor: TextModeEditor | undefined;

  get inTextMode() {
    return !!this.editor;
  }

  updateDebugMode() {
    this.editor?.setDebugMode(this.dsm.isPluginEnabled("debug-mode"));
  }

  afterDisable() {
    if (this.inTextMode) this.toggleTextMode();
  }

  toggleTextMode() {
    // Ticks update rendering, and they process sliders. Since the existing
    // expression UI doesn't render in text mode, we replace markTickRequiredNextFrame
    // with a version that calls markTickRequiredNextFrame only when sliders are playing
    if (!this.editor) {
      this.editor = new TextModeEditor(this.calc);
      this.updateDebugMode();
      this.cc.expressionSearchOpen = false;
      this.cc.markTickRequiredNextFrame = function () {
        if (this.getPlayingSliders().length > 0) {
          // eslint-disable-next-line no-proto
          (this as any).__proto__.markTickRequiredNextFrame.apply(this);
        }
      };
    } else {
      // Revert back to the old markTickRequiredNextFrame given by prototype
      delete (this.cc as any).markTickRequiredNextFrame;
      this.editor.unmount();
      this.editor = undefined;
    }
    this.cc.updateViews();
  }

  editorPanel(): Inserter {
    if (!this.editor) return undefined;
    return () =>
      DCGView.createElement("div", {
        class: DCGView.const("dsm-text-editor-container"),
        didMount: (div) =>
          this.editor?.mount(div, {
            conversionErrorUndo: () => this.toggleTextMode(),
          }),
        willUnmount: () => this.editor?.unmount(),
      });
  }

  textModeToggle(): Inserter {
    if (this.cc.isInEditListMode()) return undefined;
    return () => TextModeToggle(this);
  }
}
