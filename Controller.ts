import View from './View'
import { Calc, SimulationModel } from 'desmodder'

// kinda jank, but switching to moduleResolution: 'node' messes up
// existing non-relative imports
import { createFFmpeg, fetchFile } from './node_modules/@ffmpeg/ffmpeg/src/index.js'

type PNGDataURI = string
export type OutFileType = 'gif' | 'mp4' | 'webm'
type FFmpeg = ReturnType<typeof createFFmpeg>
export type PollingMethod = 'simulation' | 'slider'
interface SliderSettings {
  variable: string,
  min: number,
  max: number,
  step: number
}

function isValidNumber (latex: string) {
  return /^\s*\-?\d+(\.\d*)?\s*$/.test(latex)
}

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
  pollingMethod: PollingMethod = 'slider'
  sliderSettings: SliderSettings = {
    variable: 'a',
    min: 0,
    max: 10,
    step: 1
  }
  currentSimulationID: string | null = null
  simulationWhileLatex: string = ''

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

    const len = (this.frames.length - 1).toString().length
    this.frames.forEach(async (frame, i) => {
      const raw = i.toString()
      // glob orders lexicographically, but we want numerically
      const padded = '0'.repeat(len - raw.length) + raw
      const filename = `desmos.${padded}.png`
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
    if (isValidNumber(latex)) {
      this.fps = parseInt(latex)
      this.fpsHasError = false
    } else {
      this.fpsHasError = true
    }
    this._pendingUpdateView = true
    this.updateView()
  }

  setOutputFiletype (type: OutFileType) {
    this.fileType = type
    this.updateView()
  }

  setPollingMethod (method: PollingMethod) {
    this.pollingMethod = method
    this.updateView()
  }

  setSliderSetting<T extends keyof SliderSettings>(
    key: T,
    value: SliderSettings[T]
  ) {
    this.sliderSettings[key] = value
  }

  async captureSlider () {
    this.isCapturing = true
    this.updateView()

    const { variable, min, max, step } = this.sliderSettings
    const regex = new RegExp(`^(\\?\s)*${variable}(\\?\s)*=`)
    const matchingSliders = Calc.getState().expressions.list
      .filter(e => (
        e.type === 'expression' &&
        typeof e.latex === 'string' &&
        regex.test(e.latex)
      ))
    // TODO: this verification should be reflected in the UI
    if (matchingSliders.length > 0) {
      const slider = matchingSliders[0]
      const maybeNegativeNumSteps = (max - min) / step
      const m = maybeNegativeNumSteps > 0 ? 1 : -1
      const numSteps = m * maybeNegativeNumSteps
      const correctDirectionStep = m * step
      // `<= numSteps` to include the endpoints for stuff like 0 to 10, step 1
      // rarely hurts to have an extra frame
      for (let i = 0; i <= numSteps; i++) {
        const value = min + correctDirectionStep * i
        Calc.setExpression({
          id: slider.id,
          latex: `${variable}=${value}`
        })
        await this._captureFrame()
      }
    }

    this.isCapturing = false
    this.updateView()
  }

  captureSimulation () {
    this.isCapturing = true
    this.updateView()

    const simulationID = this.currentSimulationID
    // TODO: add stop condition. `while` latex via HelperExpression
    // user gives 'a < 30'
    const helper = Calc.HelperExpression({
      latex: `\\left\\{${this.simulationWhileLatex}\\right\\}`
    })

    helper.observe('numericValue', async () => {
      helper.unobserve('numericValue')
      // WARNING: helper.numericValue is evaluated asynchronously,
      // so the stop condition may be missed in rare situations.
      // But it should be evaluated faster than the captureFrame in practice

      // syntax errors and false gives helper.numericValue === NaN
      // true gives helper.numericValue === 1
      while (helper.numericValue === 1) {
        Calc.controller.dispatch({
          type: 'simulation-single-step',
          id: simulationID
        })
        await this._captureFrame()
      }

      this.isCapturing = false
      this.updateView()
    })
  }

  setSimulationWhileLatex (s: string) {
    this.simulationWhileLatex = s
  }

  getSimulations () {
    return Calc.getState().expressions.list
      .filter(
        e => e.type === 'simulation'
      ) as SimulationModel[]
  }

  getCurrentSimulation () {
    const model = Calc.controller.getItemModel(this.currentSimulationID)
    if (model === undefined) {
      // default simulation
      const sim = this.getSimulations()[0]
      this.currentSimulationID = sim.id
      return sim
    } else {
      return model as SimulationModel
    }
  }

  currentSimulationIndex () {
    return this.getSimulations().findIndex(
      e => e.id === this.currentSimulationID
    )
  }

  hasSimulation () {
    return this.getSimulations().length > 0
  }

  addToSimulationIndex (dx: number) {
    const sims = this.getSimulations()
    // add sims.length to handle (-1) % n = -1
    this.currentSimulationID = sims[
      (this.currentSimulationIndex() + sims.length + dx) % sims.length
    ].id
    this.updateView()
  }
}
