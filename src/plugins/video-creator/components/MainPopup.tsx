import VideoCreator from "..";
import { OutFileType, cancelExport } from "../backend/export";
import CaptureMethod from "./CaptureMethod";
import LoadingPie from "./LoadingPie";
import "./MainPopup.less";
import PreviewCarousel from "./PreviewCarousel";
import { Component, jsx } from "#DCGView";
import { SegmentedControl, If, Input, Button, IfElse } from "#components";
import { format } from "#i18n";
import ManagedNumberInput from "./ManagedNumberInput";
import { OrientationView } from "./OrientationView";

const fileTypeNames: OutFileType[] = [
  "gif",
  "mp4",
  "webm",
  "apng",
  "webp",
  "zip",
];

export function MainPopupFunc(vc: VideoCreator) {
  return <MainPopup vc={vc} />;
}

export default class MainPopup extends Component<{
  vc: VideoCreator;
}> {
  vc!: VideoCreator;

  init() {
    this.vc = this.props.vc();
    void this.vc.tryInitFFmpeg();
  }

  template() {
    return IfElse(() => this.vc.ffmpegLoaded, {
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
    return IfElse(() => this.vc.isExporting, {
      false: () => this.templateNormal(),
      true: () => (
        <div class="dcg-popover-interior no-intellisense dsm-vc-popover">
          <div class="dsm-vc-export-in-progress">
            {format("video-creator-exporting")}
            <LoadingPie
              progress={() => this.vc.exportProgress}
              isPending={() =>
                this.vc.exportProgress < 0 || this.vc.exportProgress > 0.99
              }
            />
          </div>
          <div class="dsm-vc-cancel-export-button">
            <Button
              color="red"
              onTap={() => {
                void cancelExport(this.vc);
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
      <div class="dcg-popover-interior no-intellisense dsm-vc-popover">
        <If predicate={() => this.vc.or.orientationMode !== "none"}>
          {() => (
            <div>
              <div class="dcg-popover-title">
                {format("video-creator-orientation")}
              </div>
              <OrientationView or={this.vc.or} />
            </div>
          )}
        </If>
        <div class="dsm-vc-capture-menu">
          <div class="dcg-popover-title">{format("video-creator-capture")}</div>
          <CaptureMethod vc={this.vc} />
        </div>
        <If predicate={() => this.vc.frames.length > 0}>
          {() => (
            <div class="dsm-vc-preview-menu">
              <div class="dsm-vc-delete-all-row">
                <div class="dcg-popover-title">
                  {format("video-creator-preview")}
                </div>
                <div class="dsm-vc-delete-all">
                  <Button color="light-gray" onTap={() => this.vc.deleteAll()}>
                    {format("video-creator-delete-all")}
                  </Button>
                </div>
              </div>
              <div
                class={() => ({
                  "dsm-vc-preview-outer": true,
                  "dsm-vc-preview-expanded": this.vc.isPlayPreviewExpanded,
                })}
                onTapEnd={(e: Event) =>
                  this.vc.isPlayPreviewExpanded &&
                  this.eventShouldCloseExpanded(e) &&
                  this.vc.togglePreviewExpanded()
                }
              >
                <div class="dsm-vc-preview-inner">
                  <PreviewCarousel vc={this.vc} />
                  <If predicate={() => this.vc.isPlayPreviewExpanded}>
                    {() => (
                      <div
                        class="dsm-vc-exit-expanded"
                        onTap={() => this.vc.togglePreviewExpanded()}
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
        <If predicate={() => this.vc.frames.length > 0}>
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
                value={() => this.vc.getOutfileName()}
                onInput={(s: string) => this.vc.setOutfileName(s)}
                required={() => true}
                placeholder={() => format("video-creator-filename-placeholder")}
                // Avoid red squiggles throughout filename
                spellcheck={() => false}
              />
              <div class="dsm-vc-export">
                <Button
                  color="blue"
                  class="dsm-vc-export-frames-button"
                  onTap={() => {
                    void this.vc.exportFrames();
                  }}
                  disabled={() =>
                    this.vc.frames.length === 0 ||
                    this.vc.isCapturing ||
                    this.vc.isExporting ||
                    !this.vc.isFPSValid()
                  }
                >
                  {() =>
                    format("video-creator-export-as", {
                      fileType: this.vc.fileType,
                    })
                  }
                </Button>
                <If predicate={() => this.vc.fileType !== "zip"}>
                  {() => (
                    <div class="dsm-vc-fps-settings">
                      {format("video-creator-fps")}
                      <ManagedNumberInput
                        focusID="export-fps"
                        // TODO-localization
                        ariaLabel="fps"
                        hasError={() => !this.vc.isFPSValid()}
                        vc={this.vc}
                        data={this.vc.fps}
                      />
                    </div>
                  )}
                </If>
              </div>
            </div>
          )}
        </If>
      </div>
    );
  }

  getSelectedFileTypeIndex() {
    return fileTypeNames.indexOf(this.vc.fileType);
  }

  setSelectedFileTypeIndex(i: number) {
    const name = fileTypeNames[i];
    if (name !== undefined) {
      this.vc.setOutputFiletype(name);
    }
  }

  eventShouldCloseExpanded(e: Event) {
    const el = e.target;
    if (!(el instanceof Element)) return false;
    return !el.closest(".dsm-vc-preview-inner");
  }
}
