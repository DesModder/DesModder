// kinda jank, but switching to moduleResolution: 'node' messes up
// existing non-relative imports
import {
  createFFmpeg,
  fetchFile,
} from "../node_modules/@ffmpeg/ffmpeg/src/index.js";
import Controller from "../Controller";

type FFmpeg = ReturnType<typeof createFFmpeg>;
export type OutFileType = "gif" | "mp4" | "webm" | "apng";

let ffmpeg: null | FFmpeg = null;

async function exportAll(ffmpeg: FFmpeg, fileType: OutFileType, fps: number) {
  const outFilename = "out." + fileType;

  const moreFlags = {
    mp4: ["-vcodec", "libx264"],
    webm: ["-vcodec", "libvpx-vp9", "-quality", "realtime", "-speed", "8"],
    // generate fresh palette on every frame (higher quality)
    // https://superuser.com/a/1239082
    gif: [
      "-lavfi",
      "palettegen=stats_mode=single[pal],[0:v][pal]paletteuse=new=1",
    ],
    apng: ["-plays", "0", "-f", "apng"],
  }[fileType];

  await ffmpeg.run(
    "-r",
    fps.toString(),
    "-pattern_type",
    "glob",
    "-i",
    "*.png",
    // average video bitrate. May have room for improvements
    "-b:v",
    "2M",
    ...moreFlags,
    outFilename
  );

  return outFilename;
}

export async function exportFrames(controller: Controller) {
  controller.setExportProgress(-1);

  // reference https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L278
  if (ffmpeg === null) {
    ffmpeg = createFFmpeg({ log: false });
    ffmpeg.setLogger(({ type, message }) => {
      if (type === "fferr") {
        const match = message.match(/frame=\s*(?<frame>\d+)/);
        if (match === null) {
          return;
        } else {
          const frame = (match.groups as { frame: string }).frame;
          let denom = controller.frames.length - 1;
          if (denom === 0) denom = 1;
          const ratio = parseInt(frame) / denom;
          controller.setExportProgress(ratio);
        }
      }
    });
    await ffmpeg.load();
  }

  const filenames: string[] = [];

  const len = (controller.frames.length - 1).toString().length;
  controller.frames.forEach(async (frame, i) => {
    const raw = i.toString();
    // glob orders lexicographically, but we want numerically
    const padded = "0".repeat(len - raw.length) + raw;
    const filename = `desmos.${padded}.png`;
    // filenames may be pushed out of order because async, but doesn't matter
    filenames.push(filename);
    if (ffmpeg !== null) {
      ffmpeg.FS("writeFile", filename, await fetchFile(frame));
    }
  });

  controller.isExporting = true;
  controller.updateView();

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
  const url = URL.createObjectURL(
    new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" })
  );

  const humanOutFilename =
    "DesModder Video Creator." +
    (controller.fileType === "apng" ? "png" : controller.fileType);
  download(url, humanOutFilename);

  controller.isExporting = false;
  controller.updateView();
}

function download(url: string, filename: string) {
  // https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L325
  // no point supporting anything besides Chrome (no SharedArrayBuffer support)
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}
