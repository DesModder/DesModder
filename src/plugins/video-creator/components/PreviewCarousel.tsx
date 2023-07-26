import VideoCreator from "..";
import "./PreviewCarousel.less";
import { Component, jsx } from "DCGView";
import { If } from "components";

export default class PreviewCarousel extends Component<{
  vc: VideoCreator;
}> {
  vc!: VideoCreator;

  init() {
    this.vc = this.props.vc();
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
          onTap={() => this.vc.addToPreviewIndex(-1)}
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
          onTap={() => this.vc.addToPreviewIndex(1)}
        >
          <img src={() => this.getFrame(1)} draggable={false} />
          <div class="dsm-vc-preview-index">
            {() => this.getFrameIndex(1) + 1}
          </div>
        </div>
        <div
          class="dsm-vc-preview-current-frame"
          onTap={() =>
            this.vc.isPlayPreviewExpanded
              ? this.vc.togglePlayingPreview()
              : this.vc.togglePreviewExpanded()
          }
        >
          <img src={() => this.getFrame(0)} draggable={false} />
          <If predicate={() => !this.vc.isPlayPreviewExpanded}>
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
                    this.vc.togglePreviewExpanded();
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
              this.vc.removeSelectedFrame();
              e.stopPropagation();
            }}
          >
            <i class="dcg-icon-delete" />
          </div>
          <div class="dsm-vc-preview-index">
            {() => `${this.getFrameIndex(0) + 1} / ${this.vc.frames.length}`}
          </div>
          <If predicate={() => this.vc.frames.length > 1}>
            {() => (
              <div
                class="dsm-vc-preview-play-pause"
                onTap={(e: Event) => {
                  this.vc.togglePlayingPreview();
                  e.stopPropagation();
                }}
              >
                <i
                  class={() => ({
                    "dcg-icon-play": !this.vc.isPlayingPreview,
                    "dcg-icon-pause": this.vc.isPlayingPreview,
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
    const L = this.vc.frames.length;
    return (((this.vc.previewIndex + dx) % L) + L) % L;
  }

  getFrame(dx: number) {
    return this.vc.frames[this.getFrameIndex(dx)];
  }
}
