/**
 * Physics Lab — AP Physics 1 and 2, and AP Calculus AB and BC, inside Desmos.
 *
 * Two things about its shape are worth stating, because both were decisions
 * rather than defaults.
 *
 * The session outlives the panel. Everything the user switches on — the slope
 * field over the graph paper — belongs to the plugin, not to the popover that
 * happens to be showing its controls, so closing the panel detaches a view and
 * stops nothing. Only disabling the plugin tears anything down.
 *
 * And the renderer is not Vector Tools'. It used to be, and now it is
 * `src/field-rendering`, which both plugins depend on and neither owns. Physics
 * Lab may still use Vector Tools where that helps — `session.vectorTools` is
 * the one accessor for it, and it is allowed to return `undefined` — but
 * nothing on the drawing path goes through it, so a disabled Vector Tools costs
 * this plugin nothing at all.
 */
import type { ConfigItem } from "..";
import { PluginController } from "../PluginController";
import { PhysicsLabPanelFunc } from "./components/PhysicsLabPanel";
import PhysicsLabSession from "./PhysicsLabSession";

interface PhysicsLabSettings {
  /**
   * The whole configuration as JSON. Hidden from DesModder's settings list
   * because it is the panel's own state, and persisted so that reopening the
   * panel comes back to the field the user set up rather than to defaults.
   */
  serializedConfig: string;
}

const POPOVER_CLASS = "dsm-physics-lab-popover";

/** Long enough that one corner drag is one write rather than sixty. */
const PANEL_SIZE_SETTLE_MS = 250;

/** Every math field in the panel, so focus can be routed back to one. */
export type PhysicsLabFocusKind =
  | "slope-f"
  | "second-f"
  | "derivative-f"
  | "derivative-attempt"
  | "integral-f"
  | "integral-lower"
  | "integral-upper"
  | "limit-f"
  | "limit-point"
  | "exact"
  | "initial-x"
  | "initial-y";

export default class PhysicsLab extends PluginController<PhysicsLabSettings> {
  static id = "physics-lab" as const;
  static enabledByDefault = false;
  static config = [
    {
      type: "string",
      variant: "text",
      default: "",
      key: "serializedConfig",
      shouldShow: () => false,
    },
  ] satisfies readonly ConfigItem[];

  private panelElement?: HTMLElement;
  private panelResizeObserver?: ResizeObserver;
  private panelSizeTimer?: ReturnType<typeof setTimeout>;
  private currentSession?: PhysicsLabSession;

  /**
   * Built on first use rather than in `afterEnable`, so a page where nobody
   * opens Physics Lab never constructs one. The constructor allocates no
   * parser and no WebGL either way.
   */
  get session() {
    this.currentSession ??= new PhysicsLabSession(this);
    return this.currentSession;
  }

  afterEnable() {
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-physics-lab-menu",
      tooltip: "physics-lab-name",
      iconClass: "dcg-icon-scientific",
      popup: () => PhysicsLabPanelFunc(this),
    });
  }

  afterDisable() {
    this.detachPanelElement();
    // The one path that really does stop everything: no canvas over the graph,
    // no dispatcher listener, no timer pending.
    this.currentSession?.destroy();
    this.currentSession = undefined;
    this.dsm.pillboxMenus?.removePillboxButton("dsm-physics-lab-menu");
  }

  /**
   * Whether one of the panel's math fields currently holds focus.
   *
   * Desmos asks this to decide whether the focus it is tracking still exists;
   * answering wrongly leaves the keypad attached to a field that has gone.
   */
  isFocused(kind: PhysicsLabFocusKind) {
    const focused = this.cc.getFocusLocation();
    return (
      focused?.type === "dsm-focus" &&
      focused.plugin === "physics-lab" &&
      focused.kind === kind
    );
  }

  /** Redraws the panel. DCGView reads getters, so this is all a change needs. */
  rerenderPanel() {
    this.util.tick();
  }

  setSetting<K extends keyof PhysicsLabSettings>(
    key: K,
    value: PhysicsLabSettings[K]
  ) {
    this.dsm.setPluginSetting("physics-lab", key, value);
  }

  attachPanelElement(element: HTMLElement) {
    this.detachPanelElement();
    this.panelElement = element;
    element.closest(".dsm-pillbox-popover")?.classList.add(POPOVER_CLASS);
    const { width, height } = this.session.getConfig().panel;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    // The panel is resized by dragging its corner, so the size has to be read
    // back off the element — there is no control to hang it on.
    this.panelResizeObserver = new ResizeObserver(() =>
      this.persistPanelSize()
    );
    this.panelResizeObserver.observe(element);
  }

  detachPanelElement() {
    if (this.panelSizeTimer !== undefined) clearTimeout(this.panelSizeTimer);
    this.panelSizeTimer = undefined;
    this.panelResizeObserver?.disconnect();
    this.panelResizeObserver = undefined;
    this.panelElement
      ?.closest(`.${POPOVER_CLASS}`)
      ?.classList.remove(POPOVER_CLASS);
    this.panelElement = undefined;
  }

  /**
   * Remembers a dragged size, once the dragging stops.
   *
   * Debounced because a drag fires the observer every frame, and each write
   * serialises the whole configuration into a plugin setting.
   */
  private persistPanelSize() {
    if (this.panelSizeTimer !== undefined) clearTimeout(this.panelSizeTimer);
    this.panelSizeTimer = setTimeout(() => {
      this.panelSizeTimer = undefined;
      const element = this.panelElement;
      if (element === undefined) return;
      // The inline style, not the rendered box. A corner drag writes the inline
      // width and height, whereas a short window merely clamps what is rendered
      // through max-height — and remembering that clamp would shrink the panel
      // permanently on the next machine it was opened on.
      const width = Math.round(Number.parseFloat(element.style.width));
      const height = Math.round(Number.parseFloat(element.style.height));
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      if (width === 0 || height === 0) return;
      const { panel } = this.session.getConfig();
      if (width === panel.width && height === panel.height) return;
      this.session.updateConfig((config) => {
        config.panel.width = width;
        config.panel.height = height;
      });
    }, PANEL_SIZE_SETTLE_MS);
  }
}
