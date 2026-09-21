import { Component, jsx } from "#DCGView";
import { format } from "#i18n";
import type AudioLab from ".";
import AudioLabRuntime from "./AudioLabRuntime";
import "./AudioLabPanel.less";

/**
 * The panel's markup, and nothing else.
 *
 * Every control carries a `data-audio-lab` name and is wired up by
 * `AudioLabRuntime`. That split is deliberate and predates this file: DCGView
 * freezes any prop passed as a bare value, writes props as attributes so
 * `disabled="false"` still disables, and cannot drive a `<select>`'s selection
 * at all — so a panel written as DCGView components would need a getter and an
 * `onUpdate` for every control. Plain markup bound imperatively is less clever
 * and behaves.
 *
 * The layout is a fixed head, a tabbed scrolling body, and a fixed footer. The
 * meters live in the head rather than in a tab because they are what tells you
 * whether anything is being heard at all, and that question comes up while
 * adjusting every other control — a waveform you have to switch tabs to see is
 * a waveform you stop using.
 */
export class AudioLabPanel extends Component<{ audioLab: () => AudioLab }> {
  template() {
    let runtime: AudioLabRuntime | undefined;
    return (
      <div
        class="dcg-popover-interior dsm-audio-lab-menu"
        didMount={(element: HTMLElement) => {
          this.props.audioLab().attachPanelElement(element);
          runtime = new AudioLabRuntime(this.props.audioLab(), element);
        }}
        willUnmount={() => {
          runtime?.destroy();
          this.props.audioLab().detachPanelElement();
        }}
      >
        <div class="dcg-popover-title">{format("audio-lab-name")}</div>

        <div class="dsm-audio-lab-head">
          <div data-audio-lab-placeholder="wave" />
          <div class="dsm-audio-lab-readouts">
            <span>
              Dominant<strong data-audio-lab="peak">—</strong>
            </span>
            <span>
              Wavelength<strong data-audio-lab="wavelength">—</strong>
            </span>
            <span>
              Tempo<strong data-audio-lab="tempo">—</strong>
            </span>
            <span>
              RMS<strong data-audio-lab="rms">—</strong>
            </span>
            <span>
              Bass / mid / treble<strong data-audio-lab="bands">—</strong>
            </span>
          </div>
          <div class="dsm-audio-lab-tabs" role="tablist">
            <button data-audio-lab-tab="source" role="tab">
              Source
            </button>
            <button data-audio-lab-tab="field" role="tab">
              Field
            </button>
            <button data-audio-lab-tab="graph" role="tab">
              Graph
            </button>
          </div>
        </div>

        <div class="dsm-audio-lab-body">
          <div data-audio-lab-panel="source">
            <section>
              <div class="dsm-audio-lab-account">
                <span data-audio-lab="account">Not signed in</span>
                <button data-audio-lab="sign-in" class="dcg-btn-blue">
                  Sign in to Spotify
                </button>
                <button
                  data-audio-lab="sign-out"
                  class="dcg-btn-light-gray"
                  hidden
                >
                  Sign out
                </button>
              </div>
              <button
                data-audio-lab="open-spotify"
                class="dcg-btn-light-gray dsm-audio-lab-wide"
              >
                Open Spotify player
              </button>
              <label for="dsm-audio-lab-spotify-url">Spotify link</label>
              <div class="dsm-audio-lab-inline">
                <input
                  data-audio-lab="spotify-url"
                  id="dsm-audio-lab-spotify-url"
                  type="url"
                />
                <button
                  data-audio-lab="spotify-load"
                  class="dcg-btn-blue"
                  disabled
                >
                  Play
                </button>
              </div>
              <div class="dsm-audio-lab-now-playing">
                <strong data-audio-lab="track">Nothing playing</strong>
                <span data-audio-lab="artist" />
                <span data-audio-lab="playback-time">0:00 / 0:00</span>
              </div>
              <div class="dsm-audio-lab-transport">
                <button
                  data-audio-lab="previous"
                  class="dcg-btn-light-gray"
                  disabled
                >
                  Previous
                </button>
                <button
                  data-audio-lab="spotify-toggle"
                  class="dcg-btn-blue"
                  disabled
                >
                  Play
                </button>
                <button
                  data-audio-lab="next"
                  class="dcg-btn-light-gray"
                  disabled
                >
                  Next
                </button>
              </div>
            </section>

            <section>
              <button
                data-audio-lab="analyze"
                class="dcg-btn-light-gray dsm-audio-lab-wide"
              >
                Analyze tab audio
              </button>
              <p class="dsm-audio-lab-hint">
                Spotify plays through an active Spotify tab or app. For the
                field and the live graph, select that tab and enable Share tab
                audio.
              </p>
              <label class="dsm-audio-lab-file">
                Local audio file
                <input data-audio-lab="file" type="file" accept="audio/*" />
              </label>
              <span data-audio-lab="filename" class="dsm-audio-lab-hint" />
              <div class="dsm-audio-lab-inline">
                <button
                  data-audio-lab="play"
                  class="dcg-btn-light-gray"
                  disabled
                >
                  Play / pause
                </button>
                <input
                  data-audio-lab="volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value="0.8"
                  aria-label="Volume"
                />
              </div>
            </section>

            <section>
              <label>Response</label>
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="response"
                role="group"
                aria-label="Response"
              />
              <p data-audio-lab="response-hint" class="dsm-audio-lab-hint" />
              <div class="dsm-audio-lab-plot-title">
                <strong>Spectrum</strong>
                <span>frequency</span>
              </div>
              <div data-audio-lab-placeholder="spectrum" />
            </section>
          </div>

          <div data-audio-lab-panel="field" hidden>
            <section>
              <label>Start from</label>
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="field-preset"
                role="group"
                aria-label="Field preset"
              />
              <p data-audio-lab="field-hint" class="dsm-audio-lab-hint" />
            </section>

            <section>
              <label>The current, as a vector field</label>
              <div class="dsm-audio-lab-component">
                <span>P(x, y) =</span>
                <input
                  data-audio-lab="field-p"
                  type="text"
                  spellcheck="false"
                  aria-label="x component"
                />
              </div>
              <div class="dsm-audio-lab-component">
                <span>Q(x, y) =</span>
                <input
                  data-audio-lab="field-q"
                  type="text"
                  spellcheck="false"
                  aria-label="y component"
                />
              </div>
              <p
                data-audio-lab="field-error"
                class="dsm-audio-lab-hint dsm-audio-lab-error"
              />
              <details class="dsm-audio-lab-details">
                <summary>What you can write in here</summary>
                <div
                  class="dsm-audio-lab-variables"
                  data-audio-lab="field-variables"
                />
                <p class="dsm-audio-lab-hint">
                  Plus x, y, t and the usual functions. Greek-named variables
                  like λ_audio exist in the graph but cannot be read here — a
                  shader identifier is a letter and a subscript.
                </p>
              </details>
            </section>

            <section>
              <label>Ripples</label>
              <p class="dsm-audio-lab-hint">
                A ring the sound drops into the current, expanding and fading.
                This is the part the expression above cannot say, because it
                remembers where and when.
              </p>
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="ripple-source"
                role="group"
                aria-label="Ripples fired by"
              />
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="ripple-origin"
                role="group"
                aria-label="Ripples start at"
              />
              <div
                class="dsm-audio-lab-numbers"
                data-audio-lab="ripple-numbers"
              />
              <button
                data-audio-lab="ripple-test"
                class="dcg-btn-light-gray dsm-audio-lab-wide"
              >
                Drop one now
              </button>
            </section>

            <section>
              <label>Cursor</label>
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="pointer-mode"
                role="group"
                aria-label="Cursor does"
              />
              <div
                class="dsm-audio-lab-numbers"
                data-audio-lab="pointer-numbers"
              />
              <label class="dsm-audio-lab-check">
                <input data-audio-lab="pointer-click" type="checkbox" />
                Clicking the graph drops a ripple
              </label>
              <p class="dsm-audio-lab-hint">
                The field's canvas takes no pointer events at all. Panning,
                zooming and clicking an expression work exactly as they do with
                this off.
              </p>
            </section>

            <details class="dsm-audio-lab-details">
              <summary>How it is drawn</summary>
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="look-color"
                role="group"
                aria-label="Colour by"
              />
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="look-palette"
                role="group"
                aria-label="Palette"
              />
              <div
                class="dsm-audio-lab-numbers"
                data-audio-lab="look-numbers"
              />
              <label class="dsm-audio-lab-check">
                <input data-audio-lab="look-normalize" type="checkbox" />
                Draw streamlines at a constant speed
              </label>
            </details>
          </div>

          <div data-audio-lab-panel="graph" hidden>
            <section>
              <label>W_audio(x) is</label>
              <div
                class="dsm-audio-lab-chips"
                data-audio-lab="wave-mode"
                role="group"
                aria-label="Wave function mode"
              />
              <p data-audio-lab="wave-mode-hint" class="dsm-audio-lab-hint" />
            </section>
            <section>
              <label
                class="dsm-audio-lab-field"
                for="dsm-audio-lab-speed-of-sound"
              >
                Speed of sound (m/s)
                <input
                  data-audio-lab="speed"
                  id="dsm-audio-lab-speed-of-sound"
                  type="number"
                  min="1"
                  step="1"
                />
              </label>
            </section>
            <section>
              <label>What the folder defines</label>
              <div
                class="dsm-audio-lab-variables"
                data-audio-lab="graph-variables"
              />
            </section>
            <section>
              <button
                data-audio-lab="graph-remove"
                class="dcg-btn-light-gray dsm-audio-lab-wide"
                disabled
              >
                Remove from graph
              </button>
              <p class="dsm-audio-lab-hint">
                Stopping leaves the variables in your graph and stops updating
                them. Removing deletes exactly what Audio Lab created, and
                nothing else.
              </p>
            </section>
          </div>
        </div>

        <div class="dsm-audio-lab-footer">
          <div class="dsm-audio-lab-transport dsm-audio-lab-primary">
            <button data-audio-lab="field-toggle" class="dcg-btn-light-gray">
              Show audio field
            </button>
            <button data-audio-lab="graph-toggle" class="dcg-btn-blue">
              Start live graph
            </button>
          </div>
          <p
            data-audio-lab="status"
            class="dsm-audio-lab-status"
            role="status"
          />
        </div>
      </div>
    );
  }
}

export function AudioLabPanelFunc(audioLab: AudioLab) {
  return <AudioLabPanel audioLab={() => audioLab} />;
}
