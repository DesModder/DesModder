export function rms(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

export function downsample(samples: Float32Array, requested: number) {
  if (samples.length === 0 || requested <= 0) return [];
  const count = Math.min(samples.length, Math.floor(requested));
  const bucket = samples.length / count;
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * bucket);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucket));
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let i = start; i < end && i < samples.length; i++) {
      minimum = Math.min(minimum, samples[i]);
      maximum = Math.max(maximum, samples[i]);
    }
    return Math.abs(maximum) >= Math.abs(minimum) ? maximum : minimum;
  });
}

export function spotifyUri(input: string) {
  const trimmed = input.trim();
  const uri =
    /^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]+)$/i.exec(
      trimmed
    );
  if (uri !== null) return `spotify:${uri[1].toLowerCase()}:${uri[2]}`;
  try {
    const url = new URL(trimmed);
    if (url.hostname !== "open.spotify.com") return undefined;
    const parts = url.pathname.split("/").filter(Boolean);
    const offset = parts[0]?.startsWith("intl-") ? 1 : 0;
    const type = parts[offset];
    const id = parts[offset + 1];
    if (
      !["track", "album", "playlist", "episode", "show"].includes(type) ||
      !/^[A-Za-z0-9]+$/.test(id ?? "")
    )
      return undefined;
    return `spotify:${type}:${id}`;
  } catch {
    return undefined;
  }
}
