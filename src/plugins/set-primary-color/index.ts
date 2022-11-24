import "./custom-overrides.less";
import "./overrides.less";
import { Plugin } from "plugins";
import { getHSVfromRGB, parseCSSHex } from "plugins/GLesmos/colorParsing";
import { OptionalProperties } from "utils/utils";

interface Config {
  primaryColor: string;
  doFavicon: boolean;
}

function scaleColor(hex: string, s: number) {
  const parsed = parseCSSHex(hex);
  const [r, g, b] = parsed ?? [0, 0, 0];
  s *= 255;
  return `${r * s}, ${g * s}, ${b * s}`;
}

const colorMapping = {
  "--dsm-primary-dark-5": 0.5,
  "--dsm-primary-dark-4": 0.725,
  "--dsm-primary-dark-3": 0.765,
  "--dsm-primary-dark-2": 0.855,
  "--dsm-primary-dark-1": 0.877,
  "--dsm-primary-color": 1,
  "--dsm-primary-light-1": 1.11,
};

function applyColor(hex: string) {
  for (const [key, scale] of Object.entries(colorMapping)) {
    const s = scaleColor(hex, scale);
    apiContainer.style.setProperty(key, `rgb(${s})`);
    apiContainer.style.setProperty(key + "-rgb", `${s}`);
  }
}

let originalImage: HTMLImageElement | null = null;
const faviconLink = document.querySelector(
  "link[rel~='icon'][type]"
) as HTMLLinkElement;
const originalHref = faviconLink.href;

function applyHexToFavicon(hex: string) {
  if (originalImage) {
    applyHexToOldFavicon(hex);
  } else {
    const image = new Image();
    image.onload = () => {
      originalImage = image;
      applyHexToOldFavicon(hex);
    };
    image.src = faviconLink.href;
  }
}

function applyHexToOldFavicon(hex: string) {
  const [r, g, b] = parseCSSHex(hex) ?? [0, 0, 0];
  const [hue, sat, li] = getHSVfromRGB(r, g, b);

  if (!originalImage) return;
  const canvas = document.createElement("canvas");
  canvas.width = originalImage.naturalWidth;
  canvas.height = originalImage.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  // assume originalImage is currently: hsv(217, 1.00, 0.73)
  ctx.filter = `saturate(${sat / 1.0})
    brightness(${li / 0.73})
    hue-rotate(${hue - 130}deg)`;
  ctx.drawImage(originalImage, 0, 0);
  faviconLink.href = canvas.toDataURL("image/png");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

let apiContainer!: HTMLElement;

function onEnable(config: Config) {
  apiContainer = document.querySelector(".dcg-calculator-api-container")!;
  applyConfig(config);
  apiContainer.classList.add("dsm-set-primary-color");
}

function applyConfig(config: Config) {
  applyColor(config.primaryColor);
  if (config.doFavicon) {
    applyHexToFavicon(config.primaryColor);
  } else {
    faviconLink.href = originalHref;
  }
}

const DEFAULT_COLOR = "#2f72dc";

function onDisable() {
  applyColor(DEFAULT_COLOR);
  apiContainer.classList.remove("dsm-set-primary-color");
  faviconLink.href = originalHref;
}

const setPrimaryColor: Plugin = {
  id: "set-primary-color",
  onEnable,
  onDisable,
  enabledByDefault: false,
  config: [
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
  ],
  onConfigChange(_: OptionalProperties<Config>, config: Config) {
    applyConfig(config);
  },
} as const;
export default setPrimaryColor;
