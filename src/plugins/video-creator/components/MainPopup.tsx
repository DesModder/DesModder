import Controller from "../Controller";
import { OutFileType, cancelExport } from "../backend/export";
import CaptureMethod from "./CaptureMethod";
import LoadingPie from "./LoadingPie";
import "./MainPopup.less";
import PreviewCarousel from "./PreviewCarousel";
import { Component, jsx } from "DCGView";
import {
  SegmentedControl,
  If,
  Input,
  Button,
  IfElse,
  InlineMathInputView,
} from "components";
import { format } from "i18n/i18n-core";
import { jquery } from "utils/depUtils";

const fileTypeNames: OutFileType[] = ["gif", "mp4", "webm", "apng"];

export function MainPopupFunc(videoCreatorController: Controller) {
  return <MainPopup controller={videoCreatorController} />;
}

export default class MainPopup extends Component<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
    void this.controller.tryInitFFmpeg();
  }

  template() {
    return IfElse(() => this.controller.ffmpegLoaded, {
      true: () => this.templateFFmpegLoaded(),
      false: () => (
        <div class="dcg-popover-interior">
          <p>{format("video-creator-ffmpeg-loading")}</p>
          <p class="dsm-delayed-reveal">
            {format("video-creator-ffmpeg-fail")}
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
            {format("video-creator-exporting")}
            <LoadingPie
              progress={() => this.controller.exportProgress}
              isPending={() =>
                this.controller.exportProgress < 0 ||
                this.controller.exportProgress > 0.99
              }
            />
          </div>
          <div class="dsm-vc-cancel-export-button">
            <Button
              color="red"
              onTap={() => {
                void cancelExport(this.controller);
              }}
            >
              {format("video-creator-cancel-export")}
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
          <div class="dcg-popover-title">{format("video-creator-capture")}</div>
          <CaptureMethod controller={this.controller} />
        </div>
        <If predicate={() => this.controller.frames.length > 0}>
          {() => (
            <div class="dsm-vc-preview-menu">
              <div class="dsm-vc-delete-all-row">
                <div class="dcg-popover-title">
                  {format("video-creator-preview")}
                </div>
                <div class="dsm-vc-delete-all">
                  <Button
                    color="light-gray"
                    onTap={() => this.controller.deleteAll()}
                  >
                    {format("video-creator-delete-all")}
                  </Button>
                </div>
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
              <div class="dcg-popover-title">
                {format("video-creator-export")}
              </div>
              <div class="dsm-vc-select-export-type">
                <SegmentedControl
                  names={fileTypeNames}
                  selectedIndex={() => this.getSelectedFileTypeIndex()}
                  setSelectedIndex={(i) => this.setSelectedFileTypeIndex(i)}
                  ariaGroupLabel={"Select export type"}
                />
              </div>
              <Input
                class="dsm-vc-outfile-name"
                value={() => this.controller.getOutfileName()}
                onInput={(s: string) => this.controller.setOutfileName(s)}
                required={() => true}
                placeholder={() => format("video-creator-filename-placeholder")}
                // Avoid red squiggles throughout filename
                spellcheck={() => false}
              />
              <div class="dsm-vc-export">
                <Button
                  color="primary"
                  class="dsm-vc-export-frames-button"
                  onTap={() => {
                    void this.controller.exportFrames();
                  }}
                  disabled={() =>
                    this.controller.frames.length === 0 ||
                    this.controller.isCapturing ||
                    this.controller.isExporting ||
                    !this.controller.isFPSValid()
                  }
                >
                  {() =>
                    format("video-creator-export-as", {
                      fileType: this.controller.fileType,
                    })
                  }
                </Button>
                <div class="dsm-vc-fps-settings">
                  {format("video-creator-fps")}
                  <InlineMathInputView
                    ariaLabel="fps"
                    handleLatexChanged={(s) => this.controller.setFPSLatex(s)}
                    hasError={() => !this.controller.isFPSValid()}
                    latex={() => this.controller.fpsLatex}
                    isFocused={() => this.controller.isFocused("export-fps")}
                    handleFocusChanged={(b) =>
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
