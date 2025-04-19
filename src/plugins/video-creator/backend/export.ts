import VideoCreator from "..";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { downloadZip } from "client-zip";
import { Console } from "#globals";

type FFmpeg = ReturnType<typeof createFFmpeg>;
type FFmpegFileType = "gif" | "mp4" | "webm" | "apng" | "webp";
export type OutFileType = FFmpegFileType | "zip";

let ffmpeg: null | FFmpeg = null;

const CROP_EVEN = ["-vf", "crop=floor(iw/2)*2:floor(ih/2)*2"];

async function exportAll(
  ffmpeg: FFmpeg,
  fileType: FFmpegFileType,
  fps: number
) {
  const outFilename = "out." + fileType;

  const outFlags = {
    // mp4s have to have even dimensions, so crop it to be even
    mp4: ["-vcodec", "libx264", ...CROP_EVEN, "-pix_fmt", "yuv420p"],
    webm: ["-vcodec", "libvpx-vp9", "-quality", "realtime", "-speed", "8"],
    // generate fresh palette on every frame (higher quality)
    // https://superuser.com/a/1239082
    gif: ["-lavfi", "palettegen=stats_mode=diff[pal],[0:v][pal]paletteuse"],
    apng: ["-plays", "0", "-f", "apng"],
    webp: ["-vcodec", "libwebp", "-lossless", "1", "-loop", "0"],
  }[fileType];

  await ffmpeg.run(
    "-r",
    fps.toString(),
    "-pattern_type",
    "glob",
    "-pix_fmt",
    "rgba",
    "-i",
    "*.png",
    ...outFlags,
    outFilename
  );

  return outFilename;
}

export async function cancelExport(vc: VideoCreator) {
  try {
    // ffmpeg.exit() always throws an error `exit(1)`,
    // which is reasonable behavior because ffmpeg would throw an error when sigkilled
    ffmpeg?.exit();
  } catch {
    ffmpeg = null;
    await initFFmpeg(vc);
    vc.isExporting = false;
    vc.updateView();
  }
}

export async function initFFmpeg(vc: VideoCreator) {
  if (ffmpeg === null) {
    ffmpeg = createFFmpeg({ log: false });
    // Idk why this doesn't just use ffmpeg.setProgress, but it works for now.
    ffmpeg.setLogger(({ type, message }) => {
      if (type === "fferr") {
        const match = /frame=\s*(?<frame>\d+)/.exec(message);
        if (match !== null) {
          const { frame } = match.groups as { frame: string };
          let denom = vc.frames.length - 1;
          if (denom === 0) denom = 1;
          const ratio = parseInt(frame) / denom;
          vc.setExportProgress(ratio);
        } else {
          Console.debug(message);
        }
      }
    });
    try {
      await ffmpeg.load();
    } catch (e) {
      ffmpeg = null;
      throw e;
    }
  }
  return ffmpeg;
}

async function* files(frames: string[]) {
  const len = frames.length.toString().length;
  let i = 1;
  for (const dataURI of frames) {
    const raw = i.toString();
    // glob orders lexicographically, but we want numerically
    const padded = "0".repeat(len - raw.length) + raw;
    const blob = await (await fetch(dataURI)).blob();
    yield { name: `img-${padded}.png`, input: blob };
    i++;
  }
}

async function exportFFmpeg(
  vc: VideoCreator,
  fileType: FFmpegFileType,
  ext: "png" | "gif" | "mp4" | "webm" | "webp"
) {
  const ffmpeg = await initFFmpeg(vc);

  const filenames: string[] = [];

  async function writeFile(filename: string, frame: Blob) {
    if (ffmpeg !== null)
      ffmpeg.FS("writeFile", filename, await fetchFile(frame));
  }

  for await (const { name, input } of files(vc.frames)) {
    filenames.push(name);
    // filenames may be pushed out of order because async, but doesn't matter
    void writeFile(name, input);
  }

  const outFilename = await exportAll(ffmpeg, fileType, vc.getFPSNumber());

  const data = ffmpeg.FS("readFile", outFilename);
  for (const filename of filenames) {
    ffmpeg.FS("unlink", filename);
  }
  ffmpeg.FS("unlink", outFilename);
  const metaExt = {
    png: "image",
    gif: "image",
    webp: "image",
    mp4: "video",
    webm: "video",
  }[ext];

  return new Blob([data.buffer as ArrayBuffer], { type: `${metaExt}/${ext}` });
}

async function exportZip(vc: VideoCreator) {
  return await downloadZip(files(vc.frames)).blob();
}

export async function exportFrames(vc: VideoCreator) {
  vc.isExporting = true;
  vc.setExportProgress(-1);
  vc.updateView();

  const { fileType } = vc;
  const ext = fileType === "apng" ? "png" : fileType;
  const blob =
    fileType === "zip"
      ? await exportZip(vc)
      : await exportFFmpeg(vc, fileType, ext as Exclude<typeof ext, "zip">);

  const url = URL.createObjectURL(blob);

  let humanOutFilename = vc.getOutfileName();
  if (!humanOutFilename.endsWith("." + ext)) {
    humanOutFilename += "." + ext;
  }
  download(url, humanOutFilename);
  URL.revokeObjectURL(url);

  vc.isExporting = false;
  vc.updateView();
}

function download(url: string, filename: string) {
  // https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L325
  // no point supporting anything besides Chrome (no SharedArrayBuffer support)
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}
