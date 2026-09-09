import { downsample, rms, spotifyUri } from "./dsp";

describe("Audio Lab DSP", () => {
  test("validates Spotify links and URIs", () => {
    expect(
      spotifyUri(
        "https://open.spotify.com/track/0USK9GYk8n1FQg5rUTWadD?si=test"
      )
    ).toBe("spotify:track:0USK9GYk8n1FQg5rUTWadD");
    expect(spotifyUri("spotify:album:abc123")).toBe("spotify:album:abc123");
    // A locale-prefixed share link is the usual shape copied out of the app.
    expect(
      spotifyUri(
        "https://open.spotify.com/intl-de/track/0USK9GYk8n1FQg5rUTWadD"
      )
    ).toBe("spotify:track:0USK9GYk8n1FQg5rUTWadD");
    expect(spotifyUri("https://example.com/track/abc")).toBeUndefined();
    expect(spotifyUri("not a link")).toBeUndefined();
  });

  test("computes RMS", () => {
    expect(rms(new Float32Array([1, -1]))).toBe(1);
    expect(rms(new Float32Array())).toBe(0);
  });

  test("downsampling keeps the extreme of each bucket, not its average", () => {
    // Averaging would report roughly zero for both buckets and lose the
    // transient entirely; the trace has to keep the peak that was there.
    expect(downsample(new Float32Array([-0.2, 0.8, -0.9, 0.1]), 2)).toEqual([
      0.800000011920929, -0.8999999761581421,
    ]);
    expect(downsample(new Float32Array(), 4)).toEqual([]);
    expect(downsample(new Float32Array([1, 2]), 0)).toEqual([]);
  });
});
