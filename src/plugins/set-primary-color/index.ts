import { OptionalProperties } from "desmodder";
import { parseCSSHex } from "plugins/GLesmos/colorParsing";
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
      default: "#127a3d",
    },
  ],
  onConfigChange(changes: ConfigOptional) {
    // called only when plugin is active
    if (changes.primaryColor !== undefined) {
      applyColor(changes.primaryColor);
    }
  },
} as const;

/**
 * {
    const image = new Image();
    const faviconLink = document.querySelector("link[rel~='icon'][type]");
    image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.filter = "hue-rotate(200deg)";
        ctx.drawImage(image, 0, 0);
        faviconLink.href = canvas.toDataURL('image/png');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    image.src = faviconLink.href
}
 */
