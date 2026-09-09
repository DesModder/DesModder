/**
 * The GLSL Audio Field runs, assembled around one preset's field function.
 *
 * Particle state lives in a floating-point texture and is stepped by rendering
 * a quad over it, which is what "ping-pong" means here: read one texture, write
 * the other, swap. The draw pass then reads positions straight out of that
 * texture by vertex id, so no particle data ever travels back to the CPU.
 */
import { FIELD_UNIFORMS, type Preset } from "./presets";

const UNIFORM_BLOCK = FIELD_UNIFORMS.map(
  (name) => `uniform float ${name};`
).join("\n");

/**
 * Shared by both passes.
 *
 * `hash` is the usual sine-fract trick. It is a poor random number generator
 * and an entirely adequate way to scatter respawns, which is all it is for.
 */
const COMMON = `#version 300 es
precision highp float;
${UNIFORM_BLOCK}
uniform vec4 uBounds;

float hash(vec2 seed) {
  return fract(sin(dot(seed, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 boundsSize() {
  return vec2(uBounds.y - uBounds.x, uBounds.w - uBounds.z);
}

vec2 randomPosition(vec2 seed) {
  return vec2(uBounds.x, uBounds.z) +
    boundsSize() * vec2(hash(seed), hash(seed + 17.3));
}
`;

const QUAD_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/**
 * Steps every particle by one frame.
 *
 * Integration uses the frame's own elapsed time, clamped, so motion is tied to
 * the clock rather than the refresh rate and a stalled tab does not teleport
 * the whole field on the frame it comes back.
 *
 * A particle is respawned when it ages out, leaves the view, or stops being a
 * finite number. That last case matters: a preset that produces a NaN would
 * otherwise leave a permanent hole in the field, because NaN fails every
 * comparison that might have caught it later.
 */
export function updateFragmentShader(preset: Preset) {
  return `${COMMON}
uniform sampler2D uParticles;
uniform float uDeltaTime;
uniform float uLifetime;
uniform float uFrameSeed;
out vec4 outState;

vec2 field(vec2 p) {
  ${preset.glsl}
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  vec4 state = texelFetch(uParticles, texel, 0);
  vec2 position = state.xy;
  float age = state.z;
  float seed = state.w;

  vec2 velocity = field(position);
  // The backstop. A preset should stay bounded on its own; this is here so a
  // preset that does not cannot fling every particle off screen at once.
  float speed = length(velocity);
  if (speed > 12.0) velocity *= 12.0 / speed;

  position += velocity * uDeltaTime;
  age += uDeltaTime;

  bool outside = position.x < uBounds.x || position.x > uBounds.y ||
                 position.y < uBounds.z || position.y > uBounds.w;
  bool broken = !(dot(position, position) >= 0.0);
  if (age > uLifetime || outside || broken) {
    position = randomPosition(vec2(seed, uFrameSeed));
    age = 0.0;
    seed = hash(vec2(seed + uFrameSeed, seed));
  }
  outState = vec4(position, age, seed);
}
`;
}

/** Writes the starting state: scattered positions, staggered ages. */
export const SEED_FRAGMENT = `${COMMON}
uniform float uLifetime;
uniform float uFrameSeed;
out vec4 outState;

void main() {
  vec2 texel = gl_FragCoord.xy;
  float seed = hash(texel + uFrameSeed);
  // Ages are spread across a whole lifetime so respawns are continuous rather
  // than the entire field blinking out together once every few seconds.
  outState = vec4(randomPosition(texel + uFrameSeed), hash(texel) * uLifetime, seed);
}
`;

/**
 * Draws one point per particle.
 *
 * Colour comes from the sound: brightness picks the hue, the particle's own
 * speed and the loudness set how strongly it burns. Alpha fades a particle in
 * as it spawns and out as it dies, so respawns are not visible as popping.
 */
export function drawVertexShader(preset: Preset) {
  return `${COMMON}
uniform sampler2D uParticles;
uniform int uResolution;
uniform float uPointSize;
uniform float uLifetime;
out float vSpeed;
out float vFade;

vec2 field(vec2 p) {
  ${preset.glsl}
}

void main() {
  ivec2 texel = ivec2(gl_VertexID % uResolution, gl_VertexID / uResolution);
  vec4 state = texelFetch(uParticles, texel, 0);
  vec2 position = state.xy;

  vec2 size = boundsSize();
  vec2 clip = vec2(
    (position.x - uBounds.x) / size.x * 2.0 - 1.0,
    (position.y - uBounds.z) / size.y * 2.0 - 1.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPointSize;

  vSpeed = clamp(length(field(position)) / 6.0, 0.0, 1.0);
  // Triangular fade across the particle's life.
  float life = clamp(state.z / max(uLifetime, 1e-3), 0.0, 1.0);
  vFade = clamp(min(life * 6.0, (1.0 - life) * 6.0), 0.0, 1.0);
}
`;
}

export const DRAW_FRAGMENT = `${COMMON}
in float vSpeed;
in float vFade;
out vec4 outColor;

// Brightness chooses a colour along one axis, from cool to warm. Kept to one
// axis on purpose: a palette that moves in two directions at once stops
// reading as a measurement of anything.
//
// Three stops rather than two, and the middle one is the reason. Interpolating
// straight from blue to red passes through a desaturated grey at the halfway
// point, which is where most music actually sits — the field came out the
// colour of pencil. Routing through green keeps the whole range saturated.
//
// All three are Desmos's own expression colours, which are chosen to be legible
// on white graph paper. That matters more than it sounds: a pale particle over
// a white background is invisible however many of them there are.
vec3 palette(float t) {
  vec3 cool = vec3(0.176, 0.439, 0.702);
  vec3 middle = vec3(0.220, 0.549, 0.275);
  vec3 warm = vec3(0.780, 0.267, 0.251);
  float x = clamp(t, 0.0, 1.0);
  return x < 0.5
    ? mix(cool, middle, x * 2.0)
    : mix(middle, warm, (x - 0.5) * 2.0);
}

void main() {
  // Round points with a soft edge; the default square is unmistakably a
  // rendering artefact rather than a particle.
  vec2 offset = gl_PointCoord - vec2(0.5);
  float radius = length(offset) * 2.0;
  if (radius > 1.0) discard;
  // Solid to half the radius, then a soft rim. Fading from the very centre
  // makes a dot that is almost entirely falloff: measured across a frame, the
  // mean covered pixel came out at 23/255 and the field read as pencil smudge.
  float edge = smoothstep(1.0, 0.5, radius);

  vec3 color = palette(uCentroid * 0.65 + vSpeed * 0.35);
  // Loudness and speed drive opacity rather than brightness. Over a light
  // background, "louder" has to mean more opaque; making it brighter instead
  // fades the field out exactly when the music gets going.
  //
  // The floor is high on purpose. A particle sitting still at a turning point
  // of the field is still a particle, and a term that multiplied opacity by
  // speed alone left half of a Pulse field invisible for half of every cycle.
  float presence = (0.7 + 0.3 * vSpeed) * (0.72 + 0.28 * uRms) + uOnset * 0.3;
  outColor = vec4(color, edge * vFade * clamp(presence, 0.0, 0.95));
}
`;

export const QUAD_VERTEX_SHADER = QUAD_VERTEX;
