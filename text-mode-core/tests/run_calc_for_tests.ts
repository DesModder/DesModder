/* eslint-disable import/first */
/* eslint-disable no-console */
document.body.dataset.loadData = JSON.stringify({ seed: "c29cb3444b1c435c8e4422a19ebf56f5" });
document.body.innerHTML = `
  <div class="dcg-sliding-interior">
    <div id="dcg-header-container"></div>
    <div id="graph-container"></div>
  </div>

  <div id="mygraphs-container"></div>
  <div id="dcg-modal-container"></div>
  <div class="dcg-loading-div-container"></div>
`

HTMLCanvasElement.prototype.getContext = () => ({
  scale: () => {}
} as any)
HTMLCanvasElement.prototype.toDataURL = () => ""

// eslint-disable-next-line rulesdir/no-reach-past-exports
import "../../node_modules/.cache/desmos/calculator_desktop.js";
