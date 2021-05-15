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
import { OutFileType } from "../backend/export";
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
  }

  template() {
    return IfElse(() => this.controller.isExporting, {
      false: () => this.templateNormal(),
      true: () => (
        <div class="dcg-popover-interior">
          <div class="video-creator-export-in-progress">
            Exporting ...
            <LoadingPie
              progress={() => this.controller.exportProgress}
              isPending={() =>
                this.controller.exportProgress < 0 ||
                this.controller.exportProgress > 0.99
              }
            />
          </div>
        </div>
      ),
    });
  }

  templateNormal() {
    return (
      <div class="dcg-popover-interior">
        <div class="video-creator-capture-menu">
          <div class="dcg-group-title">Capture</div>
          <CaptureMethod controller={this.controller} />
        </div>
        <If predicate={() => this.controller.frames.length > 0}>
          {() => (
            <div class="video-creator-preview-menu">
              <div class="dcg-group-title video-creator-delete-all-row">
                Preview
                <Tooltip tooltip="Delete all" gravity="n">
                  <Button
                    color="red"
                    onTap={() => this.controller.deleteAll()}
                    class="video-creator-delete-all-button"
                  >
                    <i class="dcg-icon-remove" />
                  </Button>
                </Tooltip>
              </div>
              <div
                class={() => ({
                  "video-creator-preview-outer": true,
                  "video-creator-preview-expanded": this.controller
                    .isPlayPreviewExpanded,
                })}
                onTapEnd={(e: Event) =>
                  this.controller.isPlayPreviewExpanded &&
                  this.eventShouldCloseExpanded(e) &&
                  this.controller.togglePreviewExpanded()
                }
              >
                <div class="video-creator-preview-inner">
                  <PreviewCarousel controller={this.controller} />
                  <If predicate={() => this.controller.isPlayPreviewExpanded}>
                    {() => (
                      <div
                        class="video-creator-exit-expanded"
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
            <div class="video-creator-export-menu">
              <div class="dcg-group-title">Export</div>
              <div class="video-creator-select-export-type">
                <SegmentedControl
                  names={fileTypeNames}
                  selectedIndex={() => this.getSelectedFileTypeIndex()}
                  setSelectedIndex={(i) => this.setSelectedFileTypeIndex(i)}
                />
              </div>
              <div class="video-creator-export">
                <Button
                  color="green"
                  class="video-creator-export-frames-button"
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
                <div class="video-creator-fps-settings">
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
    return !el.closest(".video-creator-preview-inner").length;
  }
}
