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

/** The panel's two real math fields. */
export type PhysicsLabFocusKind =
  | "slope-f"
  | "second-f"
  | "derivative-f"
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
