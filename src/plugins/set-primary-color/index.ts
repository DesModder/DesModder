import { Calc } from "../../globals/window";
import { PluginController } from "../PluginController";
import "./_overrides.less";
import "./custom-overrides.less";
import { getHSVfromRGB, parseCSSHex } from "plugins/GLesmos/colorParsing";

interface Config {
  primaryColor: string;
  doFavicon: boolean;
}

const DEFAULT_COLOR = "#2f72dc";

const colorMapping = {
  "--dsm-primary-dark-5": 0.5,
  "--dsm-primary-dark-4": 0.725,
  "--dsm-primary-dark-3": 0.765,
  "--dsm-primary-dark-2": 0.855,
  "--dsm-primary-dark-1": 0.877,
  "--dsm-primary-color": 1,
  "--dsm-primary-light-1": 1.11,
};

const configList = [
  {
    key: "primaryColor",
    type: "string",
    variant: "color",
    default: DEFAULT_COLOR,
  },
  {
    key: "doFavicon",
    type: "boolean",
    default: true,
  },
] as const;

const faviconLink = document.querySelector(
  "link[rel~='icon'][type]"
) as HTMLLinkElement;
const originalHref = faviconLink.href;

export default class SetPrimaryColor extends PluginController<Config> {
  static id = "set-primary-color" as const;
  static enabledByDefault = false;
  static config = configList;
  wiggle = 0;
  originalImage: HTMLImageElement | null = null;
  apiContainer!: HTMLElement;

  afterEnable() {
    this.apiContainer = document.querySelector(
      ".dcg-calculator-api-container"
    )!;
    this.applyConfig();
    this.apiContainer.classList.add("dsm-set-primary-color");
    this.senseDarkReader();
  }

  afterDisable() {
    this.applyColor(DEFAULT_COLOR);
    this.apiContainer.classList.remove("dsm-set-primary-color");
    faviconLink.href = originalHref;
  }

  afterConfigChange() {
    this.applyConfig();
  }

  scaleColor(hex: string, s: number) {
    const parsed = parseCSSHex(hex);
    const [r, g, b] = parsed ?? [0, 0, 0];
    s *= 255;
    return `${r * s + this.wiggle}, ${g * s}, ${b * s}`;
  }

  applyColor(hex: string) {
    this.wiggle = 0.1 - this.wiggle;
    for (const [key, scale] of Object.entries(colorMapping)) {
      const s = this.scaleColor(hex, scale);
      this.apiContainer.style.setProperty(key + "-rgb", `${s}`);
    }
  }

  applyHexToFavicon(hex: string) {
    if (this.originalImage) {
      this.applyHexToOldFavicon(hex);
    } else {
      const image = new Image();
      image.onload = () => {
        this.originalImage = image;
        this.applyHexToOldFavicon(hex);
      };
      image.src = faviconLink.href;
    }
  }

  applyHexToOldFavicon(hex: string) {
    const [r, g, b] = parseCSSHex(hex) ?? [0, 0, 0];
    const [hue, sat, li] = getHSVfromRGB(r, g, b);

    if (!this.originalImage) return;
    const canvas = document.createElement("canvas");
    canvas.width = this.originalImage.naturalWidth;
    canvas.height = this.originalImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    const [bsat, bli, bhue] = Calc.controller.isGeometry()
      ? [0.67, 0.8, 285]
      : [1, 0.73, 130];
    ctx.filter = `saturate(${sat / bsat})
    brightness(${li / bli})
    hue-rotate(${hue - bhue}deg)`;
    ctx.drawImage(this.originalImage, 0, 0);
    faviconLink.href = canvas.toDataURL("image/png");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /** Wait for up to 5 seconds for Dark Reader to add its own style. Immediately
   * re-update the colors since Dark Reader sometimes does some funny stuff. */
  senseDarkReader() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          [...m.addedNodes].some((x) =>
            (x as HTMLElement).classList.contains("darkreader")
          )
        ) {
          this.applyColor(this.settings.primaryColor);
          observer.disconnect();
        }
      }
    });
    observer.observe(document.head, {
      attributes: false,
      childList: true,
      subtree: false,
    });
    setTimeout(() => observer.disconnect(), 5000);
  }

  applyConfig() {
    this.applyColor(this.settings.primaryColor);
    if (this.settings.doFavicon) {
      this.applyHexToFavicon(this.settings.primaryColor);
    } else {
      faviconLink.href = originalHref;
    }
  }
}
