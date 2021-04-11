import View from './View'
import { Calc, SimulationModel, jquery, keys } from 'desmodder'

// kinda jank, but switching to moduleResolution: 'node' messes up
// existing non-relative imports
import { createFFmpeg, fetchFile } from './node_modules/@ffmpeg/ffmpeg/src/index.js'

type PNGDataURI = string
export type OutFileType = 'gif' | 'mp4' | 'webm'
type FFmpeg = ReturnType<typeof createFFmpeg>
export type PollingMethod = 'once' | 'simulation' | 'slider'
interface SliderSettings {
  variable: string,
  minLatex: string,
  maxLatex: string,
  stepLatex: string
}

function isValidNumber (latex: string) {
  return /^\s*\-?\d+(\.\d*)?\s*$/.test(latex)
}

export default class Controller {
  view: View | null = null
  frames: PNGDataURI[] = []
  isMainViewOpen = false
  isCapturing = false
  isExporting = false
  fpsLatex = '30'
  fileType: OutFileType = 'gif'
  pollingMethod: PollingMethod = 'once'
  sliderSettings: SliderSettings = {
    variable: 'a',
    minLatex: '0',
    maxLatex: '10',
    stepLatex: '1'
  }
  currentSimulationID: string | null = null
  simulationWhileLatex = ''
  previewIndex = 0
  isPlayingPreview = false
  playPreviewInterval: number | null = null
  isPlayPreviewExpanded = false

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

  async captureFrame () {
    return new Promise<void>((resolve) => {
      Calc.asyncScreenshot(
        {
          showLabels: true,
          mode: 'contain',
          preserveAxisLabels: true
        },
        data => {
          this.frames.push(data)
          this.updateView()
          resolve()
        }
      )
    })
  }

  async export (ffmpeg: FFmpeg) {
    const outFilename = 'out.' + this.fileType

    const moreFlags = {
      mp4: ['-vcodec', 'libx264'],
      webm: ['-vcodec', 'libvpx-vp9'],
      // generate fresh palette on every frame (higher quality)
      // https://superuser.com/a/1239082
      gif: ['-lavfi', 'palettegen=stats_mode=single[pal],[0:v][pal]paletteuse=new=1']
    }[this.fileType]

    const fps = parseFloat(this.fpsLatex)

    await ffmpeg.run(
      '-r', fps.toString(),
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

    const outFilename = await this.export(ffmpeg)

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

  isFPSValid () {
    return isValidNumber(this.fpsLatex)
  }

  setFPSLatex (latex: string) {
    this.fpsLatex = latex
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
    this.updateView()
  }

  isSliderSettingValid<T extends keyof SliderSettings>(
    key: T
  ) {
    if (key === 'variable') {
      return this.getMatchingSlider() !== undefined
    } else {
      return isValidNumber(this.sliderSettings[key])
    }
  }

  getMatchingSlider () {
    const regex = new RegExp(`^(\\?\s)*${this.sliderSettings.variable}(\\?\s)*=`)
    return Calc.getState().expressions.list
      .filter(e => (
        e.type === 'expression' &&
        typeof e.latex === 'string' &&
        regex.test(e.latex)
      ))[0]
  }

  async captureSlider () {
    const variable = this.sliderSettings.variable
    const min = parseFloat(this.sliderSettings.minLatex)
    const max = parseFloat(this.sliderSettings.maxLatex)
    const step = parseFloat(this.sliderSettings.stepLatex)
    const slider = this.getMatchingSlider()
    if (slider === undefined) {
      return
    }
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
      await this.captureFrame()
    }
  }

  isWhileLatexValid () {
    // not a perfect solution. See notes for improvement
    // (section titled "improve handling of whileLatex")
    return '\\geq \\leq = > <'
      .split(' ')
      .some(s => this.simulationWhileLatex.includes(s))
  }

  captureSimulation () {
    const simulationID = this.currentSimulationID
    if (/^(\\?\s)*$/.test(this.simulationWhileLatex)) {
      // would give an infinite loop, probably unintended
      // use 1 > 0 for intentional infinite loop
      this.isCapturing = false
      this.updateView()
      return
    }

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
        await this.captureFrame()
      }

      this.isCapturing = false
      this.updateView()
    })
  }

  async capture () {
    this.isCapturing = true
    this.updateView()
    if (this.pollingMethod !== 'once') {
      Calc.controller.stopPlayingSimulation()
      Calc.controller.stopAllSliders()
    }
    if (this.pollingMethod === 'simulation') {
      this.captureSimulation()
      // captureSimulation handles settings isCapturing to false
    } else {
      if (this.pollingMethod === 'once') {
        await this.captureFrame()
      } else if (this.pollingMethod === 'slider') {
        await this.captureSlider()
      }
      this.isCapturing = false
      this.updateView()
    }
  }

  areCaptureSettingsValid () {
    if (this.pollingMethod === 'once') {
      return true
    } else if (this.pollingMethod === 'slider') {
      return (
        this.isSliderSettingValid('variable') &&
        this.isSliderSettingValid('minLatex') &&
        this.isSliderSettingValid('maxLatex') &&
        this.isSliderSettingValid('stepLatex')
      )
    } else if (this.pollingMethod === 'simulation') {
      return this.isWhileLatexValid()
    }
  }

  setSimulationWhileLatex (s: string) {
    this.simulationWhileLatex = s
    this.updateView()
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
      if (sim !== undefined) {
        this.currentSimulationID = sim.id
      }
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
    const sim = sims[
      (this.currentSimulationIndex() + sims.length + dx) % sims.length
    ]
    if (sim !== undefined) {
      this.currentSimulationID = sim.id
    }
    this.updateView()
  }

  addToPreviewIndex (dx: number) {
    this.previewIndex += dx;
    this.previewIndex %= this.frames.length
    this.updateView()
  }

  togglePlayingPreview () {
    this.isPlayingPreview = !this.isPlayingPreview
    if (this.frames.length <= 1) {
      this.isPlayingPreview = false
    }
    this.updateView()

    const fps = parseFloat(this.fpsLatex)
    if (this.isPlayingPreview) {
      this.playPreviewInterval = window.setInterval(() => {
        this.addToPreviewIndex(1)
      }, 1000/fps)
    } else {
      if (this.playPreviewInterval !== null) {
        clearInterval(this.playPreviewInterval)
      }
    }
  }

  togglePreviewExpanded () {
    this.isPlayPreviewExpanded = !this.isPlayPreviewExpanded
    if (this.isPlayPreviewExpanded) {
      jquery(document).on('keydown.gif-creator-preview-expanded', (e: KeyboardEvent) => {
        if (keys.lookup(e) === 'Esc') {
          this.togglePreviewExpanded()
        }
      })
    } else {
      jquery(document).off('keydown.gif-creator-preview-expanded')
    }
    this.updateView()
  }

  removeSelectedFrame () {
    this.frames.splice(this.previewIndex, 1)
    if (this.previewIndex >= this.frames.length) {
      this.previewIndex = this.frames.length - 1
    }
    if (this.frames.length == 0 && this.isPlayPreviewExpanded) {
      this.togglePreviewExpanded()
    }
    if (this.frames.length <= 1 && this.isPlayingPreview) {
      this.togglePlayingPreview()
    }
    this.updateView()
  }
}
