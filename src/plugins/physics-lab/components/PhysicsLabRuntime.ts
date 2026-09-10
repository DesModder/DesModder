/**
 * Binds the panel's DOM to the session, and nothing else.
 *
 * This object lives exactly as long as the panel is open. It owns no solver,
 * no canvas and no expression: every control asks the session to do something
 * and every readout is drawn from what the session reports. Closing the panel
 * destroys this and leaves the session running.
 *
 * There is deliberately no state in this file. On attach it reads the session
 * and renders what it finds, which is what makes reopening the panel show the
 * truth rather than a set of defaults.
 */
import type PhysicsLab from "..";
import type PhysicsLabSession from "../PhysicsLabSession";

export default class PhysicsLabRuntime {
  private readonly session: PhysicsLabSession;
  private readonly listeners: (() => void)[] = [];
  /** The exact form currently on screen, and so the one Add would insert. */
  private pending?: string;

  constructor(
    private readonly plugin: PhysicsLab,
    private readonly root: HTMLElement
  ) {
    this.session = plugin.session;

    this.on<HTMLInputElement>("exact-input", "input", () => this.readExact());
    this.on("exact-insert", "click", () => this.insertExact());

    this.find("status").textContent = this.session.vectorTools
      ? "Vector Tools is enabled; its field rendering is available here."
      : "Vector Tools is disabled. Everything here still works; slope fields will draw with Physics Lab's own renderer.";

    this.readExact();
  }

  private find<T extends Element>(name: string) {
    const element = this.root.querySelector<T>(`[data-physics-lab="${name}"]`);
    if (element === null)
      throw new Error(`Missing Physics Lab element: ${name}`);
    return element;
  }

  private on<T extends HTMLElement>(
    name: string,
    event: string,
    handler: (element: T) => void
  ) {
    const element = this.find<T>(name);
    const listener = () => handler(element);
    element.addEventListener(event, listener);
    this.listeners.push(() => element.removeEventListener(event, listener));
  }

  /**
   * Reads the exact value of whatever is typed, and says nothing when there is
   * nothing to add.
   *
   * The empty readout is the common case and it is not a failure: most of what
   * a person types has a variable in it or is already a plain integer, and a
   * panel that answers those with an error message would be wrong far more
   * often than it was right.
   */
  private readExact() {
    const latex = this.find<HTMLInputElement>("exact-input").value;
    const output = this.find("exact-output");
    const decimal = this.find("exact-decimal");
    const insert = this.find<HTMLButtonElement>("exact-insert");

    const reading = this.session.exactValue(latex);
    if (reading === undefined || reading.trivial) {
      this.pending = undefined;
      output.textContent = "";
      decimal.textContent = "";
      // Assigned as a property, never as an attribute: `disabled="false"` is
      // still a disabled input in HTML.
      insert.disabled = true;
      return;
    }

    this.pending = reading.latex;
    output.textContent = reading.latex;
    decimal.textContent = `≈ ${reading.value.toPrecision(12)}`;
    insert.disabled = false;
  }

  /**
   * Puts the exact form into the graph, where Desmos renders it as maths.
   *
   * There is no second maths renderer here on purpose. Desmos already draws
   * LaTeX better than anything this plugin would ship, and an expression in the
   * list is also the form that survives without the extension — someone opening
   * the shared graph sees `2\sqrt2` whether or not they have ever heard of
   * Physics Lab.
   */
  private insertExact() {
    if (this.pending === undefined) return;
    this.plugin.calc.setExpression({ latex: this.pending });
  }

  destroy() {
    for (const remove of this.listeners) remove();
    this.listeners.length = 0;
  }
}
