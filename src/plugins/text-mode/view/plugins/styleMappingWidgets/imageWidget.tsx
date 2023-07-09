import { toggleString } from ".";
import "./imageWidget.less";
import { EditorView, WidgetType } from "@codemirror/view";
import { jsx } from "utils/utils";

class ImageWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
  }

  eq(other: ImageWidget) {
    return other.value === this.value;
  }

  toDOM(view: EditorView) {
    const res = (
      <span class="dsm-inline-image">
        <img src={this.value}></img>
        <input type="file" accept="image/*" style="display: none"></input>
      </span>
    );
    const fileInput = res.querySelector("input") as HTMLInputElement;
    res.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files?.length) {
        Desmos.imageFileToDataURL(
          fileInput.files[0],
          (err, dataURI: string) => {
            err || toggleString(view, view.posAtDOM(res), this.value, dataURI);
          }
        );
      }
    });
    return res;
  }
}

export default {
  paths: [".url", ".hoveredImage", ".depressedImage"],
  Widget: ImageWidget,
};
