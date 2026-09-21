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
  `B_audio`, `M_audio`, `T_audio`, `S_audio`, `O_audio`, `R_audio`, `N_audio` —
  plus the recent sample lists `X_wave` and `Y_wave`, the spectrum lists
  `F_bin` and `S_bin`, and `W_audio(x)`.
- Offers `W_audio(x)` as a representative sinusoid, an interpolation through
  the recent samples, or a sum of the strongest eight components, with the
  panel saying which of the three you are looking at.
- Draws Audio Field: GPU particles with trails behind the graph paper, advected
  by a vector field the user can edit. The two components are Desmos LaTeX over
  x and y that may read any of the audio variables, compiled to GLSL by the
  shared `latexToGLSL`. Five presets are starting points rather than fixed
  modes: Stream, Pulse, Vortex, Spectrum storm, and Still water.
- Drops **ripples** into that field. A ripple is an expanding ring with an
  origin, a birth time and a strength, emitted on an onset or on the beat, and
  it is the one part of the field that cannot be an expression — see
  "Why ripples are not an expression" below.
- Lets the cursor push, pull or stir the field, and drop a ripple on a click,
  through passive listeners that never intercept a Desmos gesture.
- Keeps the capture, the field, and the live variables running when the panel
  is closed, and remembers the wave mode, the whole field configuration, the
  response, and the speed of sound across a page reload.
- Cleans up animation frames, polling, pending requests, object URLs, audio
  nodes, streams, WebGL resources, observers, and message listeners when the
  plugin is disabled.

## Lifetimes

This is the part most likely to be got wrong by a later change.

| Object            | Lives for                        | Owns                                                              |
| ----------------- | -------------------------------- | ----------------------------------------------------------------- |
| `AudioLabSession` | as long as the plugin is enabled | audio graph, engine, Desmos adapter, field overlay, analysis loop |
| `AudioLabRuntime` | as long as the panel is open     | the panel's DOM bindings and canvases, and nothing else           |

Closing the panel calls `session.detach()`, which stops the panel canvases, the
readouts, and the Spotify polling — none of which is worth doing when nobody
can see them — and stops nothing else. A field drawing behind the graph and a
folder of live variables were turned on deliberately and are turned off the
same way.

`session.destroy()` is the one path that stops everything, and only
`afterDisable` calls it.

The view holds no state. On attach it reads the session and renders whatever it
finds, which is what makes reopening the panel mid-song show the truth instead
of a set of defaults. **Do not add teardown to the view's `destroy`.** There is
a test in `AudioLabSession.unit.test.ts` that toggles the graph on, detaches,
and asserts it is still live, because this is exactly the kind of behaviour
that rots quietly with every other test still green.

The analysis loop runs when the field, the graph, or an open panel wants it,
and stops when none of the three does.

## Rates

Rate separation is the design, not an optimisation.

| Consumer       | Rate                  | Why                                    |
| -------------- | --------------------- | -------------------------------------- |
| Analysis       | up to every frame     | Set by the response control            |
| Desmos scalars | ~12 Hz, coalesced     | A calculator is a mathematical display |
| Desmos lists   | ~8 Hz, coalesced      | Same, and lists cost more to parse     |
| Audio Field    | every animation frame | Uniform uploads only                   |

The field reads the latest measurement on its **own** clock rather than being
pushed one, through `FlowOverlay`'s `beforeFrame` hook. That is what lets the
particles stay at sixty frames a second while the analysis runs at whatever
rate the response setting asks for, without a second animation loop and without
the parameters uploaded belonging to a different moment than the frame that
used them.

The work behind a Desmos write is not done on frames that will not carry one.
`DesmosAudioAdapter.dueForLists` is public for exactly that: reducing the
spectrum to display points and finding the strongest components are each a walk
over every bin, and they used to be computed on every frame to feed a write
that happens eight times a second.

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
index.ts             the plugin controller; owns the session
AudioLabSession.ts   everything that keeps running when the panel is closed
AudioLabRuntime.ts   the panel view: DOM bindings and canvases, no state
AudioLabPanel.tsx    the markup, and the .less beside it
audio/               AudioAnalysisEngine and the primitives it is built from
desmos/              the expression manifest, latex builders, throttled adapter
field/               the audio field: configuration, presets, ripples, cursor
```

Nothing in `audio/` writes to Desmos and nothing in it touches WebGL. The engine
publishes a frame; the adapter and the field each sample it on their own clock,
which is what lets either be switched off without changing what the other sees.

## The field, and where it lives

Audio Lab no longer has a renderer. It drives **`src/field-rendering/`**, the
neutral package Vector Tools and Physics Lab also drive, and everything the
field gets from that — particle trails, the glow, the palettes, reprojecting
the trails across a pan, surviving a lost context — is code this plugin does
not own a second copy of. The handoff used to warn that Audio Lab's
`fieldplay/glTestDouble.ts` was a deliberate duplicate and that merging the two
should be into a neutral package rather than by one plugin importing the
other's. That is what happened, in the other direction: the package already
existed, and Audio Lab moved onto it.

`field/` is what is left, and all of it is Audio Lab's own:

| File                      | What it is                                          |
| ------------------------- | --------------------------------------------------- |
| `model.ts`                | `AudioFieldConfig`, the presets, and the normalizer |
| `variables.ts`            | the audio values a field expression may read        |
| `compile.ts`              | configuration → `FlowField`, through `latexToGLSL`  |
| `RippleEmitter.ts`        | onsets and beats → the shader's ripple slots        |
| `PointerTracker.ts`       | the cursor, in graph coordinates, read-only         |
| `AudioFieldController.ts` | one overlay, one configuration, one frame at a time |

Two things were added to the neutral package for this, both opt-in and both
absent from the shader when they are not asked for, so every field that
predates them compiles to exactly the source it did before:

- **`FieldDisturbances`** on a `FlowField` — a ripple slot count and a pointer
  flag. Only the _count_ is part of the field's identity, because only that
  changes the shader; the ripples themselves arrive each frame through
  `setDisturbances`, like parameters do.
- **`FlowOverlayIdentity`** — the canvas id and the bounds-observer key. These
  were hardcoded to Vector Tools' values, and `mount` removes any element
  already carrying the id, precisely so a reload cannot stack two of the same
  overlay's canvases. Two plugins sharing one id turns that safeguard into each
  one deleting the other. Vector Tools keeps its values as the default.

### Why ripples are not an expression

`P` and `Q` are functions of position and of the current sound, so they can say
"push harder while the bass is loud". They cannot say "a drum hit happened
_there_, _then_, and the front from it is now this far out" — that needs
remembering, and an expression does not remember. So a ripple is state: an
origin, a birth time and a signed strength, in a fixed-size uniform array that
`RippleEmitter` writes in place.

The slot count is a constant rather than a setting, because a uniform array
length is part of the shader and a count that moved with a control would relink
two programs whenever that control moved. Turning ripples off asks for zero
slots, which is the one case that does rebuild — and it is a click, not a drag.

Onsets are counted rather than detected from the impulse height. The field
draws faster than the analysis measures, so the frame an onset fired on is read
several times over, and a rising-edge test on `frame.onset` would emit a ring
on each of them. `frame.onsetCount` is what makes "the same onset" unambiguous.

### Why "Still water" has a current in it

It does, and it has to. A field that is exactly zero draws nothing at all: the
renderer respawns any particle whose step rounds to zero — otherwise a genuine
fixed point would collect particles forever — and a particle fades in over its
first several frames, so with no current every particle outside a ripple is
respawned every frame and none lives long enough to become visible. A blank
canvas reporting no error. The preset therefore has a very slow wander in it,
slow enough that what you see is still the rings.

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
   audio**, and confirm both canvases animate and the readouts move. Try all
   three **Response** settings against a drum track and check that Snappy
   visibly reacts sooner than Smooth.
7. Press **Start live graph**. An Audio Lab folder should appear and its
   variables should move with the music. Check that `lambda_audio` follows
   `f_audio`, and that the dominant frequency shows an em dash rather than a
   number during a drum break.
8. Switch `W_audio(x)` through all three modes and confirm the curve changes
   meaning while the variables keep updating.
9. Press **Show audio field** and try each preset in the Field tab. Confirm
   that pan, zoom, the keypad, and clicking an expression all still work with
   it running.
10. On **Still water**, press **Drop one now** and watch a single ring expand
    and fade. Then move the ripple numbers and confirm each does what it says.
11. Edit `P(x, y)` to something of your own and press Enter. The field should
    change without the trails blinking out, the preset chip should move to
    **Yours**, and a name it cannot read should be reported under the boxes
    rather than anywhere else.
12. Move the cursor over the graph with the cursor mode on push, pull and stir.
    Click the graph and confirm a ripple appears where you clicked, and that
    dragging to pan does **not** leave one behind.
13. Turn on Desmos's reverse contrast. The field must keep its own colours
    rather than appearing as the negative of itself.
14. Press **Stop updating the graph** and confirm the expressions stay. Press
    **Remove from graph** and confirm they go and nothing else does.
15. With the field running and the graph live, **close the panel**. Both must
    keep going. Reopen it and confirm the buttons read "Hide audio field" and
    "Stop updating the graph" rather than having reset.
16. Reload the page and reopen the panel. The wave mode, the whole field
    configuration, the response, and the speed of sound should be as you left
    them.
17. Turn on **both** Audio Lab's field and Vector Tools' flow visualizer.
    Neither canvas may disappear, and stopping one must not stop the other.
18. Disable Audio Lab in the DesModder plugin list. The field canvas must
    disappear and the capture must stop.

### Things worth checking that the tests cannot

The unit tests run against a fake WebGL that never compiles a shader, so shader
correctness and everything about how the field _looks_ is only ever verified by
running it. The same goes for the panel's layout inside the real pillbox.

Both were checked for this change against a real WebGL2 context and a real
browser, outside Desmos — every preset's field function compiled, and the
panel was driven by the real `AudioLabRuntime` against a stubbed session. What
that cannot cover is the pillbox itself, tab capture, and how the field sits
against a real graph, which is what the manual pass above is for.

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
- A field expression may read `x`, `y`, `t` and the audio variables, and
  nothing else. It deliberately does not compile against the expression list
  the way Vector Tools' does: this configuration persists across graphs, and a
  field that silently depended on a `g(x)` the user had defined would stop
  compiling the moment it was carried to a graph without one.
- Greek-named variables cannot be used in a field expression. `latexToGLSL`
  shares Desmos's identifier grammar — a letter and an optional subscript — so
  `\lambda_{audio}` reads as the command `\lambda` followed by nothing. Both
  it and `\phi_{audio}` are still defined in the graph; they are simply not
  available in the two component boxes, and the panel says so.
- Ripple _speed_ is in graph units per second and has nothing to do with
  `c_audio`. A ring is a picture of an event, not a simulation of a wave in
  air, and giving it the speed of sound would send it off screen in a frame at
  any ordinary zoom.
- **Not done:** the CPU fallback for machines without WebGL2. The field refuses
  with a clear message and the live graph keeps working, which satisfies the
  specification's requirement that one being unavailable does not take the
  other down. A real fallback means a second implementation of the field in
  TypeScript, and two copies of a field function drifting apart is a worse
  failure than not having the fallback. Worth doing deliberately, with the
  field maths in one place, rather than as an afterthought here.
- **Not measured:** the field's frame cost. The old renderer carried a quality
  ladder that dropped particles when a frame ran long, and it measured the
  wrong thing — `performance.now()` around a series of GL calls times how long
  the CPU took to _submit_ work, not how long the GPU took to do it, so the
  ladder was reading a number near zero whatever the field was doing. It was
  not replaced with a better measurement; it was removed, and particle count
  and render detail are controls in the panel instead. A real answer is
  `EXT_disjoint_timer_query_webgl2`, which is worth doing deliberately.
