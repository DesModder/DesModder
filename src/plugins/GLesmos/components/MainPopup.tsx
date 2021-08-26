import { DCGView, Button } from "desmodder";
import Controller from "../Controller";

export function MainPopupFunc(controller: Controller) {
  return <MainPopup controller={controller} />;
}

export default class MainPopup extends DCGView.Class<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
  }

  template() {
    return (
      <div class="dcg-popover-interior">
        <div class="dcg-group-title"> GLesmos </div>
        <Button color="green" onTap={() => this.controller.reapplyShader()}>
          Reapply shader
        </Button>
      </div>
    );
  }
}
