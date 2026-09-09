import { Component, jsx } from "#DCGView";
import { format } from "#i18n";
import type AudioLab from ".";
import AudioLabRuntime from "./AudioLabRuntime";
import "./AudioLabPanel.less";

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
        <div class="dsm-audio-lab-body">
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
          </section>
          <section>
            <label>Spotify link</label>
            <div class="dsm-audio-lab-inline">
              <input data-audio-lab="spotify-url" type="url" />
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
              <button data-audio-lab="next" class="dcg-btn-light-gray" disabled>
                Next
              </button>
            </div>
            <button
              data-audio-lab="analyze"
              class="dcg-btn-light-gray dsm-audio-lab-wide"
            >
              Analyze tab audio
            </button>
            <p class="dsm-audio-lab-hint">
              Spotify plays through an active Spotify tab or app. For live
              graphs, select that tab and enable Share tab audio.
            </p>
          </section>
          <section>
            <label class="dsm-audio-lab-file">
              Local audio file
              <input data-audio-lab="file" type="file" accept="audio/*" />
            </label>
            <span data-audio-lab="filename" class="dsm-audio-lab-hint" />
            <div class="dsm-audio-lab-inline">
              <button data-audio-lab="play" class="dcg-btn-light-gray" disabled>
                Play / pause
              </button>
              <input
                data-audio-lab="volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value="0.8"
              />
            </div>
          </section>
          <section>
            <div class="dsm-audio-lab-plot-title">
              <strong>Waveform</strong>
              <span>amplitude</span>
            </div>
            <div data-audio-lab-placeholder="wave" />
            <div class="dsm-audio-lab-plot-title">
              <strong>Spectrum</strong>
              <span>frequency</span>
            </div>
            <div data-audio-lab-placeholder="spectrum" />
          </section>
          <section>
            <div class="dsm-audio-lab-readouts">
              <span>
                Dominant<strong data-audio-lab="peak">—</strong>
              </span>
              <span>
                Wavelength<strong data-audio-lab="wavelength">—</strong>
              </span>
              <span>
                Confidence<strong data-audio-lab="confidence">—</strong>
              </span>
              <span>
                RMS<strong data-audio-lab="rms">—</strong>
              </span>
              <span>
                Bass / mid / treble<strong data-audio-lab="bands">—</strong>
              </span>
            </div>
            <div class="dsm-audio-lab-inline">
              <label class="dsm-audio-lab-field">
                Speed of sound (m/s)
                <input data-audio-lab="speed" type="number" min="1" step="1" />
              </label>
              <label class="dsm-audio-lab-field">
                Analysis quality
                <select data-audio-lab="quality">
                  <option value="performance">Performance</option>
                  <option value="balanced" selected>
                    Balanced
                  </option>
                  <option value="quality">Quality</option>
                </select>
              </label>
            </div>
          </section>
          <section>
            <label>Audio field</label>
            <select data-audio-lab="field-preset" class="dsm-audio-lab-wide" />
            <p data-audio-lab="field-hint" class="dsm-audio-lab-hint" />
            <button
              data-audio-lab="field-toggle"
              class="dcg-btn-light-gray dsm-audio-lab-wide"
            >
              Show audio field
            </button>
          </section>
          <section>
            <label>W_audio(x) is</label>
            <select data-audio-lab="wave-mode" class="dsm-audio-lab-wide">
              <option value="representative" selected>
                Representative wave
              </option>
              <option value="recent">Recent waveform</option>
              <option value="additive">Additive spectrum</option>
            </select>
            <p data-audio-lab="wave-mode-hint" class="dsm-audio-lab-hint" />
          </section>
        </div>
        <div class="dsm-audio-lab-footer">
          <button
            data-audio-lab="graph-toggle"
            class="dcg-btn-blue dsm-audio-lab-wide"
          >
            Start live graph
          </button>
          <button
            data-audio-lab="graph-remove"
            class="dcg-btn-light-gray dsm-audio-lab-wide"
            disabled
          >
            Remove from graph
          </button>
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
