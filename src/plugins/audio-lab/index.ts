import type { ConfigItem } from "..";
import { PluginController } from "../PluginController";
import { AudioLabPanelFunc } from "./AudioLabPanel";
import AudioLabSession from "./AudioLabSession";

interface AudioLabSettings {
  spotifyUrl: string;
  waveMode: "representative" | "recent" | "additive";
  fieldPreset: "pulse" | "vortex" | "flow" | "storm";
  quality: "performance" | "balanced" | "quality";
  /** Stored as a string so it round-trips through the string config type. */
  speedOfSound: string;
}

const POPOVER_CLASS = "dsm-audio-lab-popover";

export default class AudioLab extends PluginController<AudioLabSettings> {
  static id = "audio-lab" as const;
  static enabledByDefault = true;
  // None of these are shown in the DesModder settings list. They are the
  // panel's own controls, persisted so that reopening the panel — or reloading
  // the page — comes back to the setup the user last chose rather than to
  // defaults.
  static config = [
    {
      type: "string",
      variant: "text",
      default: "",
      key: "spotifyUrl",
      shouldShow: () => false,
    },
    {
      type: "string",
      variant: "text",
      default: "representative",
      key: "waveMode",
      shouldShow: () => false,
    },
    {
      type: "string",
      variant: "text",
      default: "pulse",
      key: "fieldPreset",
      shouldShow: () => false,
    },
    {
      type: "string",
      variant: "text",
      default: "balanced",
      key: "quality",
      shouldShow: () => false,
    },
    {
      type: "string",
      variant: "text",
      default: "343",
      key: "speedOfSound",
      shouldShow: () => false,
    },
  ] satisfies readonly ConfigItem[];

  private panelElement?: HTMLElement;
  private currentSession?: AudioLabSession;

  /**
   * The session outlives the panel.
   *
   * Everything the user switches on — tab capture, the audio field, the live
   * folder in the graph — belongs to the plugin, not to the popover that
   * happens to be showing its controls. Closing the panel detaches the view;
   * only disabling the plugin tears any of it down.
   */
  get session() {
    // Built on first use rather than in `afterEnable`, so a page where nobody
    // opens Audio Lab never constructs one. The constructor allocates no
    // AudioContext and no WebGL either way.
    this.currentSession ??= new AudioLabSession(this);
    return this.currentSession;
  }

  afterEnable() {
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-audio-lab-menu",
      tooltip: "audio-lab-name",
      iconClass: "dcg-icon-play",
      popup: () => AudioLabPanelFunc(this),
    });
  }

  afterDisable() {
    this.detachPanelElement();
    // The one path that really does stop everything. A disabled plugin must
    // leave no capture running, no canvas over the graph, and no animation
    // frame scheduled.
    this.currentSession?.destroy();
    this.currentSession = undefined;
    this.dsm.pillboxMenus?.removePillboxButton("dsm-audio-lab-menu");
  }

  afterConfigChange() {
    this.util.tick();
  }

  setSetting<K extends keyof AudioLabSettings>(
    key: K,
    value: AudioLabSettings[K]
  ) {
    this.dsm.setPluginSetting("audio-lab", key, value);
  }

  attachPanelElement(element: HTMLElement) {
    this.panelElement = element;
    element.closest(".dsm-pillbox-popover")?.classList.add(POPOVER_CLASS);
  }

  detachPanelElement() {
    this.panelElement
      ?.closest(`.${POPOVER_CLASS}`)
      ?.classList.remove(POPOVER_CLASS);
    this.panelElement = undefined;
  }
}
