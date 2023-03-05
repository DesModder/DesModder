import Controller from "../Controller";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

type FFmpeg = ReturnType<typeof createFFmpeg>;
export type OutFileType = "gif" | "mp4" | "webm" | "apng";

let ffmpeg: null | FFmpeg = null;

async function exportAll(ffmpeg: FFmpeg, fileType: OutFileType, fps: number) {
  const outFilename = "out." + fileType;

  const outFlags = {
    mp4: ["-vcodec", "libx264"],
    webm: ["-vcodec", "libvpx-vp9", "-quality", "realtime", "-speed", "8"],
    // generate fresh palette on every frame (higher quality)
    // https://superuser.com/a/1239082
    gif: ["-lavfi", "palettegen=stats_mode=diff[pal],[0:v][pal]paletteuse"],
    apng: ["-plays", "0", "-f", "apng"],
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

export async function cancelExport(controller: Controller) {
  try {
    // ffmpeg.exit() always throws an error `exit(1)`,
    // which is reasonable behavior because ffmpeg would throw an error when sigkilled
    ffmpeg?.exit();
  } catch {
    ffmpeg = null;
    await initFFmpeg(controller);
    controller.isExporting = false;
    controller.updateView();
  }
}

export async function initFFmpeg(controller: Controller) {
  if (ffmpeg === null) {
    ffmpeg = createFFmpeg({
      log: false,
      corePath: "https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
    });
    ffmpeg.setLogger(({ type, message }) => {
      if (type === "fferr") {
        const match = message.match(/frame=\s*(?<frame>\d+)/);
        if (match !== null) {
          const frame = (match.groups as { frame: string }).frame;
          let denom = controller.frames.length - 1;
          if (denom === 0) denom = 1;
          const ratio = parseInt(frame) / denom;
          controller.setExportProgress(ratio);
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

export async function exportFrames(controller: Controller) {
  controller.isExporting = true;
  controller.setExportProgress(-1);
  controller.updateView();

  const ffmpeg = await initFFmpeg(controller);

  const filenames: string[] = [];

  async function writeFile(filename: string, frame: string) {
    if (ffmpeg !== null)
      ffmpeg.FS("writeFile", filename, await fetchFile(frame));
  }

  const len = (controller.frames.length - 1).toString().length;
  controller.frames.forEach((frame, i) => {
    const raw = i.toString();
    // glob orders lexicographically, but we want numerically
    const padded = "0".repeat(len - raw.length) + raw;
    const filename = `desmos.${padded}.png`;
    // filenames may be pushed out of order because async, but doesn't matter
    filenames.push(filename);
    void writeFile(filename, frame);
  });

  const outFilename = await exportAll(
    ffmpeg,
    controller.fileType,
    controller.getFPSNumber()
  );

  const data = ffmpeg.FS("readFile", outFilename);
  for (const filename of filenames) {
    ffmpeg.FS("unlink", filename);
  }
  ffmpeg.FS("unlink", outFilename);
  const ext = controller.fileType === "apng" ? "png" : controller.fileType;
  const metaExt = { png: "image", gif: "image", mp4: "video", webm: "video" }[
    ext
  ];
  const url = URL.createObjectURL(
    new Blob([data.buffer as ArrayBuffer], { type: `${metaExt}/${ext}` })
  );

  let humanOutFilename = controller.getOutfileName();
  if (!humanOutFilename.endsWith("." + ext)) {
    humanOutFilename += "." + ext;
  }
  download(url, humanOutFilename);

  controller.isExporting = false;
  controller.updateView();
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
