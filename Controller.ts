import View from './View'
import { Calc } from 'desmodder'

// kinda jank, but switching to moduleResolution: 'node' messes up
// existing non-relative imports
import { createFFmpeg, fetchFile } from './node_modules/@ffmpeg/ffmpeg/src/index.js'

type PNGDataURI = string
export type OutFileType = 'gif' | 'mp4' | 'webm'
type FFmpeg = ReturnType<typeof createFFmpeg>

export default class Controller {
  view: View | null = null
  frames: PNGDataURI[] = []
  _pendingUpdateView = false
  isMainViewOpen: boolean = false
  isCapturing: boolean = false
  isExporting: boolean = false
  fpsHasError: boolean = false
  fps: number = 30
  fileType: OutFileType = 'gif'

  init (view: View) {
    this.view = view
  }

  updateView () {
    this.view && this.view.update()
  }

  toggleMainView () {
    this.isMainViewOpen = !this.isMainViewOpen
    this.updateView()
  }

  closeMainView () {
    this.isMainViewOpen = false
    this.updateView()
  }

  async _captureFrame () {
    return new Promise<void>((resolve) => {
      Calc.asyncScreenshot(
        {
          showLabels: true,
          mode: 'contain',
          preserveAxisLabels: true
        },
        data => {
          this.frames.push(data)
          resolve()
        }
      )
    })
  }

  async captureOneFrame () {
    this.isCapturing = true
    this.updateView()
    await this._captureFrame()
    this.isCapturing = false
    this.updateView()
  }

  async transcode (ffmpeg: FFmpeg) {
    const outFilename = 'out.' + this.fileType

    const moreFlags = {
      mp4: ['-vcodec', 'libx264'],
      webm: ['-vcodec', 'libvpx-vp9'],
      // generate fresh palette on every frame (higher quality)
      // https://superuser.com/a/1239082
      gif: ['-lavfi', 'palettegen=stats_mode=single[pal],[0:v][pal]paletteuse=new=1']
    }[this.fileType]

    await ffmpeg.run(
      '-r', this.fps.toString(),
      '-pattern_type', 'glob', '-i', '*.png',
      // average video bitrate. May have room for improvements
      '-b:v', '2M',
      ...moreFlags,
      outFilename
    );

    return outFilename
  }

  async exportFrames () {
    // reference https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L278
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load()

    const filenames: string[] = []

    this.frames.forEach(async (frame, i) => {
      const filename = `desmos.${i}.png`
      // filenames may be pushed out of order because async, but doesn't matter
      filenames.push(filename)
      ffmpeg.FS('writeFile', filename, await fetchFile(frame))
    })

    this.isExporting = true
    this.updateView()

    const outFilename = await this.transcode(ffmpeg)

    const data = ffmpeg.FS('readFile', outFilename)
    filenames.forEach(filename => {
      ffmpeg.FS('unlink', filename)
    })
    ffmpeg.FS('unlink', outFilename)
    const url = URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' }))

    const humanOutFilename = 'DesModder\ Video\ Creator.' + this.fileType
    this.download(url, humanOutFilename)

    this.isExporting = false
    this.updateView()
  }

  download (url: string, filename: string) {
    // https://gist.github.com/SlimRunner/3b0a7571f04d3a03bff6dbd9de6ad729#file-desmovie-user-js-L325
    // no point supporting anything besides Chrome (no SharedArrayBuffer support)
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }

  updatePendingView() {
    if (this._pendingUpdateView) {
      this._pendingUpdateView = false
      this.updateView()
    }
  }

  setFPSLatex (latex: string) {
    const pruned = latex.replace(/\s/g, '')
    if (/^\d+$/.test(pruned)) {
      this.fps = parseInt(pruned)
      this.fpsHasError = false
    } else {
      this.fpsHasError = true
    }
    this._pendingUpdateView = true
  }

  setOutputFiletype (type: OutFileType) {
    this.fileType = type
    this.updateView()
  }
}
