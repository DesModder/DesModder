import { Plugin } from "plugins";

function getHeaderElement(): HTMLElement | null {
  return document.querySelector(".header-account-name");
}

let oldName = "";

function onEnable() {
  const headerElement = getHeaderElement();
  if (headerElement === null) return;
  const text = headerElement.innerText;
  if (text !== undefined) oldName = text;
  headerElement.innerText = "DesModder ♥";
}

function onDisable() {
  const headerElement = getHeaderElement();
  if (headerElement === null) return;
  headerElement.innerText = oldName;
}

const changeUsername: Plugin = {
  id: "change-username",
  onEnable,
  onDisable,
  enabledByDefault: false,
};
export default changeUsername;
