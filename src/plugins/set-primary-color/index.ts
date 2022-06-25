import { OptionalProperties } from "utils/utils";
import { getHSVfromRGB, parseCSSHex } from "plugins/GLesmos/colorParsing";
import "./overrides.less";
import "./custom-overrides.less";

interface Config {
  primaryColor: string;
  doFavicon: boolean;
}

function scaleColor(hex: string, s: number) {
  const parsed = parseCSSHex(hex);
  const [r, g, b] = parsed ?? [0, 0, 0];
  s *= 255;
  return `rgb(${r * s}, ${g * s}, ${b * s})`;
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
    apiContainer.style.setProperty(key, scaleColor(hex, scale));
  }
}

let originalImage: HTMLImageElement | null = null;
const faviconLink = document.querySelector(
  "link[rel~='icon'][type]"
) as HTMLLinkElement;

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
  // assume originalImage is currently: hsv(217, 0.79, 0.93)
  ctx.filter = `saturate(${sat / 0.79})
    brightness(${li / 0.93})
    hue-rotate(${hue - 217}deg)`;
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
    faviconLink.href = "/favicon.ico";
  }
}

function onDisable() {
  apiContainer.classList.remove("dsm-set-primary-color");
  faviconLink.href = "/favicon.ico";
}

export default {
  id: "set-primary-color",
  name: "Set Primary Color",
  description: "Choose the primary color for the user interface",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: false,
  config: [
    {
      key: "primaryColor",
      name: "Primary Color",
      description: "Primary color across the calculator",
      type: "color",
      // Desmos Blue, unfortunately
      // We don't set green as default because it's hard to match up
      // button color and favicon color when green
      default: "#2f72dc",
    },
    {
      key: "doFavicon",
      name: "Update Site Icon",
      description: "Toggle updating the site icon",
      type: "boolean",
      default: true,
    },
  ],
  onConfigChange(_: OptionalProperties<Config>, config: Config) {
    applyConfig(config);
  },
} as const;
