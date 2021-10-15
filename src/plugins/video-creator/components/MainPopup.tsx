import {
  DCGView,
  SmallMathQuillInput,
  SegmentedControl,
  If,
  jquery,
  Button,
  IfElse,
  Tooltip,
} from "desmodder";
import CaptureMethod from "./CaptureMethod";
import PreviewCarousel from "./PreviewCarousel";
import LoadingPie from "./LoadingPie";
import Controller from "../Controller";
import { OutFileType, cancelExport } from "../backend/export";
import "./MainPopup.less";

const fileTypeNames: OutFileType[] = ["gif", "mp4", "webm", "apng"];

export function MainPopupFunc(videoCreatorController: Controller) {
  return <MainPopup controller={videoCreatorController} />;
}

export default class MainPopup extends DCGView.Class<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
    this.controller.tryInitFFmpeg();
  }

  template() {
    return IfElse(() => this.controller.ffmpegLoaded, {
      true: () => this.templateFFmpegLoaded(),
      false: () => (
        <div class="dcg-popover-interior">
          <p>FFmpeg loading...</p>
          <p class="dsm-delayed-reveal">
            If this doesn't work in the next few seconds, try reloading the page
            or reporting this bug to DesModder devs.
          </p>
        </div>
      ),
    });
  }

  templateFFmpegLoaded() {
    return IfElse(() => this.controller.isExporting, {
      false: () => this.templateNormal(),
      true: () => (
        <div class="dcg-popover-interior">
          <div class="dsm-vc-export-in-progress">
            Exporting ...
            <LoadingPie
              progress={() => this.controller.exportProgress}
              isPending={() =>
                this.controller.exportProgress < 0 ||
                this.controller.exportProgress > 0.99
              }
            />
          </div>
          <div class="dsm-vc-cancel-export-button">
            <Button color="blue" onTap={() => cancelExport(this.controller)}>
              Cancel
            </Button>
          </div>
        </div>
      ),
    });
  }

  templateNormal() {
    return (
      <div class="dcg-popover-interior">
        <div class="dsm-vc-capture-menu">
          <div class="dcg-group-title">Capture</div>
          <CaptureMethod controller={this.controller} />
        </div>
        <If predicate={() => this.controller.frames.length > 0}>
          {() => (
            <div class="dsm-vc-preview-menu">
              <div class="dcg-group-title dsm-vc-delete-all-row">
                Preview
                <Tooltip tooltip="Delete all" gravity="n">
                  <Button
                    color="red"
                    onTap={() => this.controller.deleteAll()}
                    class="dsm-vc-delete-all-button"
                  >
                    <i class="dcg-icon-remove" />
                  </Button>
                </Tooltip>
              </div>
              <div
                class={() => ({
                  "dsm-vc-preview-outer": true,
                  "dsm-vc-preview-expanded":
                    this.controller.isPlayPreviewExpanded,
                })}
                onTapEnd={(e: Event) =>
                  this.controller.isPlayPreviewExpanded &&
                  this.eventShouldCloseExpanded(e) &&
                  this.controller.togglePreviewExpanded()
                }
              >
                <div class="dsm-vc-preview-inner">
                  <PreviewCarousel controller={this.controller} />
                  <If predicate={() => this.controller.isPlayPreviewExpanded}>
                    {() => (
                      <div
                        class="dsm-vc-exit-expanded"
                        onTap={() => this.controller.togglePreviewExpanded()}
                      >
                        <i class="dcg-icon-remove" />
                      </div>
                    )}
                  </If>
                </div>
              </div>
            </div>
          )}
        </If>
        <If predicate={() => this.controller.frames.length > 0}>
          {() => (
            <div class="dsm-vc-export-menu">
              <div class="dcg-group-title">Export</div>
              <div class="dsm-vc-select-export-type">
                <SegmentedControl
                  names={fileTypeNames}
                  selectedIndex={() => this.getSelectedFileTypeIndex()}
                  setSelectedIndex={(i) => this.setSelectedFileTypeIndex(i)}
                />
              </div>
              <div class="dsm-vc-export">
                <Button
                  color="green"
                  class="dsm-vc-export-frames-button"
                  onTap={() => this.controller.exportFrames()}
                  disabled={() =>
                    this.controller.frames.length === 0 ||
                    this.controller.isCapturing ||
                    this.controller.isExporting ||
                    !this.controller.isFPSValid()
                  }
                >
                  Export as {() => this.controller.fileType}
                </Button>
                <div class="dsm-vc-fps-settings">
                  FPS:
                  <SmallMathQuillInput
                    ariaLabel="fps"
                    onUserChangedLatex={(s) => this.controller.setFPSLatex(s)}
                    hasError={() => !this.controller.isFPSValid()}
                    latex={() => this.controller.fpsLatex}
                    isFocused={() => this.controller.isFocused("export-fps")}
                    onFocusedChanged={(b) =>
                      this.controller.updateFocus("export-fps", b)
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </If>
      </div>
    );
  }

  getSelectedFileTypeIndex() {
    return fileTypeNames.indexOf(this.controller.fileType);
  }

  setSelectedFileTypeIndex(i: number) {
    const name = fileTypeNames[i];
    if (name !== undefined) {
      this.controller.setOutputFiletype(name);
    }
  }

  eventShouldCloseExpanded(e: Event) {
    const el = jquery(e.target);
    return !el.closest(".dsm-vc-preview-inner").length;
  }
}
