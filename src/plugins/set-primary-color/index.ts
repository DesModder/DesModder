import { OptionalProperties } from "desmodder";
import { getHSVfromRGB, parseCSSHex } from "plugins/GLesmos/colorParsing";
import "./overrides.less";
import "./custom-overrides.less";

interface Config {
  primaryColor: string;
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
  applyHexToFavicon(hex);
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

type ConfigOptional = OptionalProperties<Config>;

let apiContainer!: HTMLElement;

function onEnable(config: Config) {
  apiContainer = document.querySelector(".dcg-calculator-api-container")!;
  applyColor(config.primaryColor);
  apiContainer.classList.add("dsm-set-primary-color");
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
      // Blue, unfortunately
      // We don't set green as default because it's hard to match up
      // button color and favicon color when green
      default: "#2f72dc",
    },
  ],
  onConfigChange(changes: ConfigOptional) {
    // called only when plugin is active
    if (changes.primaryColor !== undefined) {
      applyColor(changes.primaryColor);
    }
  },
} as const;
