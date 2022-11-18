import Controller from "../Controller";
import "./PreviewCarousel.less";
import { Component, jsx } from "DCGView";
import { If } from "components";

export default class PreviewCarousel extends Component<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
  }

  template() {
    return (
      <div class="dsm-vc-preview-carousel">
        <div
          class={() => ({
            "dsm-vc-preview-prev-frame": true,
            "dsm-vc-preview-wrapped-frame":
              this.getFrameIndex(-1) > this.getFrameIndex(0),
          })}
          onTap={() => this.controller.addToPreviewIndex(-1)}
        >
          <img src={() => this.getFrame(-1)} draggable={false} />
          <div class="dsm-vc-preview-index">
            {() => this.getFrameIndex(-1) + 1}
          </div>
        </div>
        <div
          class={() => ({
            "dsm-vc-preview-next-frame": true,
            "dsm-vc-preview-wrapped-frame":
              this.getFrameIndex(1) < this.getFrameIndex(0),
          })}
          onTap={() => this.controller.addToPreviewIndex(1)}
        >
          <img src={() => this.getFrame(1)} draggable={false} />
          <div class="dsm-vc-preview-index">
            {() => this.getFrameIndex(1) + 1}
          </div>
        </div>
        <div
          class="dsm-vc-preview-current-frame"
          onTap={() =>
            this.controller.isPlayPreviewExpanded
              ? this.controller.togglePlayingPreview()
              : this.controller.togglePreviewExpanded()
          }
        >
          <img src={() => this.getFrame(0)} draggable={false} />
          <If predicate={() => !this.controller.isPlayPreviewExpanded}>
            {() => (
              <div
                class="dsm-vc-preview-expand"
                onTap={(e: Event) => {
                  if (
                    e.target &&
                    (e.target as HTMLElement).classList.contains(
                      "dsm-vc-preview-expand"
                    )
                  ) {
                    this.controller.togglePreviewExpanded();
                    e.stopPropagation();
                  }
                }}
              >
                <i class="dcg-icon-zoom-fit" />
              </div>
            )}
          </If>
          <div
            class="dsm-vc-remove-frame"
            onTap={(e: Event) => {
              this.controller.removeSelectedFrame();
              e.stopPropagation();
            }}
          >
            <i class="dcg-icon-delete" />
          </div>
          <div class="dsm-vc-preview-index">
            {() =>
              `${this.getFrameIndex(0) + 1} / ${this.controller.frames.length}`
            }
          </div>
          <If predicate={() => this.controller.frames.length > 1}>
            {() => (
              <div
                class="dsm-vc-preview-play-pause"
                onTap={(e: Event) => {
                  this.controller.togglePlayingPreview();
                  e.stopPropagation();
                }}
              >
                <i
                  class={() => ({
                    "dcg-icon-play": !this.controller.isPlayingPreview,
                    "dcg-icon-pause": this.controller.isPlayingPreview,
                  })}
                />
              </div>
            )}
          </If>
        </div>
      </div>
    );
  }

  getFrameIndex(dx: number) {
    const L = this.controller.frames.length;
    return (((this.controller.previewIndex + dx) % L) + L) % L;
  }

  getFrame(dx: number) {
    return this.controller.frames[this.getFrameIndex(dx)];
  }
}
