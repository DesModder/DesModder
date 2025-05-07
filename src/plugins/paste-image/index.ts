import { PluginController } from "../PluginController";
import { format } from "#i18n";
import type { DispatchedEvent } from "#globals";
import type { AtLeastOne } from "#utils/utils.ts";

export default class PasteImage extends PluginController {
  static id = "paste-image" as const;
  static enabledByDefault = true;

  pasteHandler = this._pasteHandler.bind(this);

  afterEnable() {
    document.addEventListener("paste", this.pasteHandler);
  }

  afterDisable() {
    document.removeEventListener("paste", this.pasteHandler);
  }

  _pasteHandler(e: ClipboardEvent) {
    const clipboardFiles = e.clipboardData?.files;
    if (!clipboardFiles?.length) return;
    if (!this.cc.areImagesEnabled()) {
      this.cc._showToast({
        // eslint-disable-next-line @desmodder/eslint-rules/no-format-in-ts
        message: format("paste-image-error-images-not-enabled"),
      });
    } else if (this.cc.isUploadingImages()) {
      this.waitForImageUploads({
        runFinally: () =>
          this.cc._showToast({
            // eslint-disable-next-line @desmodder/eslint-rules/no-format-in-ts
            message: format("paste-image-error-another-upload-in-progress"),
          }),
      });
    } else {
      const { 0: nonImageFiles, 1: imageFiles } = Object.groupBy(
        clipboardFiles,
        ({ type: mimeType }) => +/image\/*/.test(mimeType)
      );
      // Among the possible errors, only those related to an invalid MIME type is not handled by the image-upload-error event
      if (nonImageFiles)
        setTimeout(() =>
          this.cc._showToast({
            message: this.cc.s("graphing-calculator-error-image-invalid-file", {
              file: nonImageFiles[0].name,
            }),
          })
        );
      if (!imageFiles) return;
      const selectedItem = this.cc.getSelectedItem();
      // Do nothing when the focused element is not an expression textarea
      if (!selectedItem && document.activeElement !== document.body) return;
      if (!selectedItem || selectedItem.isHiddenFromUI) {
        // Avoid images accidentally going into special folders,
        // and being inserted at the top of the expression list when there is no selected expression
        const lastVisibleExpression = this.cc
          .getAllItemModels()
          .findLast((model) => !model.isHiddenFromUI);
        if (lastVisibleExpression) {
          this.setFocusLocation(lastVisibleExpression.id);
        } else {
          this.cc.dispatch({ type: "new-expression-at-end" });
        }
      }
      e.preventDefault();
      this.waitForImageUploads({
        // Callback ID_1 has already been invoked so __nextItemId is incremented
        runAfterSuccess: () => this.setFocusLocation(this.cc.__nextItemId - 1),
        runFinally: () => this.cc.scrollSelectedItemIntoView(),
      });
      this.cc.dispatch({
        type: "new-images",
        files: imageFiles,
      });
    }
  }

  setFocusLocation(exprId: string | number) {
    this.cc.dispatch({
      type: "set-focus-location",
      location: { type: "expression", id: exprId.toString() },
    });
  }

  waitForImageUploads({
    runAfterSuccess,
    runFinally,
  }: AtLeastOne<{
    runAfterSuccess: () => void;
    runFinally: () => void;
  }>) {
    const handleImageUpload = (e: DispatchedEvent) => {
      switch (e.type) {
        case "image-upload-success":
          runAfterSuccess?.();
        // eslint-disable-next-line no-fallthrough
        case "image-upload-error":
          if (!this.cc.isUploadingImages())
            setTimeout(() => {
              runFinally?.();
              this.cc.dispatcher.unregister(callbackId);
            });
          break;
      }
    };
    const callbackId = this.cc.dispatcher.register(handleImageUpload);
  }
}
