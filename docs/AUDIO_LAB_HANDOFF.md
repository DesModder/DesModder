# Audio Lab handoff for Claude Code

## Read this first

Audio Lab is an independent DesModder plugin on `feature/audio-lab` and draft PR
#2. It must remain separate from Vector Tools. Do not move Audio Lab into
`src/plugins/vector-tools`, import either plugin from the other, or combine their
settings, controllers, panels, tests, generated expression IDs, or lifecycle.

The branch started from main commit `930bd35`, after Vector Tools PR #1 was
merged. Audio Lab development deliberately did not edit any file under
`src/plugins/vector-tools`.

## What version 1 does

- Adds Audio Lab to DesModder's utility menu as an enabled-by-default plugin.
- Signs in to Spotify using Authorization Code with PKCE. No client secret is
  used or stored.
- Accepts Spotify track, album, playlist, episode, and show links.
- Controls playback on the user's active Spotify player: play a pasted link,
  pause, resume, previous, and next.
- Shows the current track, artist, device, progress, and duration.
- Opens Spotify in a normal browser tab when the user needs to activate a
  playback device.
- Captures audio only after the user clicks **Analyze tab audio** and explicitly
  selects a tab with **Share tab audio** enabled.
- Optionally analyzes a local audio file.
- Measures each frame into one feature set: loudness, peak, a parabolically
  refined dominant frequency with a confidence, the wavelength that follows
  from it, three band energies, brightness, spectral flux, onsets, and a beat
  phase.
- Maintains a managed Audio Lab folder of live Desmos variables —
  `t_audio`, `A_audio`, `f_audio`, `phi_audio`, `c_audio`, `lambda_audio`,
  `B_audio`, `M_audio`, `T_audio` — plus the recent sample lists `X_wave` and
  `Y_wave`, the spectrum lists `F_bin` and `S_bin`, and `W_audio(x)`.
- Offers `W_audio(x)` as a representative sinusoid, an interpolation through
  the recent samples, or a sum of the strongest eight components, with the
  panel saying which of the three you are looking at.
- Draws Audio Field: eight thousand GPU particles behind the graph paper in one
  of four presets (Pulse, Vortex, Flow, Spectrum Storm), driven by uniforms
  only and degrading down a quality ladder to hold a 30 FPS floor.
- Cleans up animation frames, polling, pending requests, object URLs, audio
  nodes, streams, WebGL resources, observers, and message listeners when the
  panel closes.

## Rates

Rate separation is the design, not an optimisation.

| Consumer       | Rate                  | Why                                    |
| -------------- | --------------------- | -------------------------------------- |
| Analysis       | every animation frame | The field needs it                     |
| Desmos scalars | ~12 Hz, coalesced     | A calculator is a mathematical display |
| Desmos lists   | ~8 Hz, coalesced      | Same, and lists cost more to parse     |
| Audio Field    | every animation frame | Uniform uploads only                   |

Nothing serialises the graph during playback. Creation is one `setState`;
every update after it is `setExpressions` with an id and a latex string, and
values that have not changed are dropped before they are sent.

## Ownership

Audio Lab removes only the exact IDs in `src/plugins/audio-lab/desmos/manifest.ts`.
Sharing the `audio_lab_` prefix is not the same as being owned by Audio Lab,
and there is a regression test that keeps a user expression named
`audio_lab_notes`.

**Stop** leaves the expressions in the graph and stops updating them, because
by then the user may have written their own work against `A_audio`.
**Remove from graph** is the button that deletes, and closing the panel does
neither.

## Architecture and security

Spotify OAuth and Web API requests run in the extension background worker in
`src/spotify.ts`. Tokens stay in `chrome.storage.local` and are never posted to
the Desmos page. The page plugin sends typed commands through the existing
page/content/background message bridge and receives only safe profile or
playback data.

The public Spotify client ID is:

```text
4052ea1384df4eb9a35141159c5a328e
```

The redirect registered during development is:

```text
https://dedbladjlfimolmophheclffaonghgic.chromiumapp.org/spotify
```

If Chrome assigns a different unpacked-extension ID, add the corresponding
`https://<extension-id>.chromiumapp.org/spotify` URI in the Spotify developer
dashboard. Never add a Spotify client secret to this repository.

Spotify playback is intentionally not embedded in an iframe. Spotify blocks the
original page URL from framing, and a remote player SDK is a poor fit for a
Manifest V3 extension. Audio Lab controls the user's active Spotify tab or app
through the Web API. A Spotify Premium account and an active playback device are
required by Spotify for these player endpoints.

The Web API cannot expose decoded copyrighted audio samples. Live visualization
therefore uses Chrome's user-approved tab capture. This is why playback and
analysis are two separate buttons.

## Owned files

Audio Lab owns all files under:

```text
src/plugins/audio-lab/
```

It also adds one focused Spotify service:

```text
src/spotify.ts
```

Shared integration files touched by the feature are:

- `src/plugins/index.ts`: plugin registration and typed getter.
- `src/core-plugins/pillbox-menus/components/Menu.tsx`: utility-menu entry.
- `localization/en.ftl`: English plugin name and description.
- `public/chrome/manifest.json`: `identity`, Spotify API host permissions.
- `src/background.ts`: dispatches Spotify commands to the background service.
- `src/preload/content.ts`: forwards typed Audio Lab requests and responses.
- `src/utils/messages.ts`: declares the message protocol and returns listener
  handles so Audio Lab can unregister its page listener.

Conflicts in those shared files should be resolved semantically while retaining
both Claude's optimization changes and the small Audio Lab integration hooks.

## Layout inside the plugin

```text
audio/       AudioAnalysisEngine and the feature primitives it is built from
desmos/      the expression manifest, latex builders, and the throttled adapter
fieldplay/   presets, shaders, the WebGL renderer, and the canvas overlay
```

Nothing in `audio/` writes to Desmos and nothing in it touches WebGL. The engine
publishes a frame; the adapter and the overlay each sample it on their own
clock, which is what lets either be switched off without changing what the
other sees.

`fieldplay/glTestDouble.ts` is Audio Lab's own fake WebGL, deliberately not
shared with the one in `src/plugins/vector-tools/flow/`. A test helper reaching
across that boundary is still a dependency across it. If the two are ever
merged, it should be into a neutral package with its own tests, not by one
plugin importing the other's.

## Verification

```bash
npm run lint
npm run test:unit
npm run build
npm run build-ff
```

Run `npm run test:integration` when the environment can download/access the
Desmos calculator fixture.

Manual Chrome test:

1. Build with `npm run build`.
2. Load or reload the repository's `dist` folder at `chrome://extensions`.
3. Open or hard-refresh `https://www.desmos.com/calculator`.
4. Open the DesModder menu and select **Audio Lab**.
5. Sign in, open Spotify, start any track once, paste a Spotify link, and press
   **Play**.
6. Press **Analyze tab audio**, choose the Spotify tab, enable **Share tab
   audio**, and confirm both canvases animate and the readouts move.
7. Press **Start live graph**. An Audio Lab folder should appear and its
   variables should move with the music. Check that `lambda_audio` follows
   `f_audio`, and that the dominant frequency shows an em dash rather than a
   number during a drum break.
8. Switch `W_audio(x)` through all three modes and confirm the curve changes
   meaning while the variables keep updating.
9. Press **Show audio field** and try each preset. Confirm that pan, zoom, the
   keypad, and clicking an expression all still work with it running.
10. Press **Stop updating the graph** and confirm the expressions stay. Press
    **Remove from graph** and confirm they go and nothing else does.
11. Close and reopen the panel, then repeat analysis to check cleanup and source
    switching.

### Things worth checking that the tests cannot

The unit tests run against a fake WebGL that never compiles a shader, so shader
correctness and everything about how the field _looks_ is only ever verified by
running it. The same goes for the panel's layout inside the real pillbox, and
for how the field reads against Desmos's dark/reverse-contrast mode, which has
not been tuned.

If the Audio Lab button is missing, check that the loaded extension points to
the current `dist`, `audio-lab` is present in the plugin registry and utility
category, it is enabled in the DesModder plugin list, and Desmos was refreshed
after the extension reload.

## Current boundaries

- Chrome OAuth is supported. Firefox builds compile, but Spotify sign-in reports
  that it is Chrome-only until an equivalent Firefox identity flow is added.
- Audio Lab analyzes the mixed tab output that Chrome supplies; Spotify does not
  provide per-instrument stems or raw samples through its Web API.
- Sample lists are bounded at 192 waveform and 96 spectrum points, for
  calculator responsiveness.
- `F_bin` carries real frequencies in hertz, so the in-graph spectrum sits from
  0 to 12 kHz on the x axis and needs zooming out to see next to the waveform.
  The alternative was squeezing it into the same window as the wave, which
  would have meant an x axis that is hertz for one curve and metres for the
  other. The panel's own spectrum canvas is there for the at-a-glance view.
- The additive mode's component phases are a chosen animation, not a
  measurement. `AnalyserNode` reports magnitudes only; there is no phase to
  read. This is why the mode is labelled an approximation for Fourier work
  rather than a reconstruction.
- **Not done:** the CPU fallback for machines without WebGL2. The field refuses
  with a clear message and the live graph keeps working, which satisfies the
  specification's requirement that one being unavailable does not take the
  other down. A real fallback means a second implementation of all four fields
  in TypeScript, and two copies of a field function drifting apart is a worse
  failure than not having the fallback. Worth doing deliberately, with the
  field maths in one place, rather than as an afterthought here.
- **Not tuned:** Desmos's dark / reverse-contrast mode. The field's colours are
  chosen for white graph paper. Vector Tools solves the same problem with a
  counter-invert on its canvas; Audio Lab needs an equivalent, and it should be
  looked at on screen rather than reasoned about.
