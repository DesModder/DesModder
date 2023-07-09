import Controller from "./Controller";
import ReplaceBar from "./ReplaceBar";
import {
  MountedComponent,
  constArg,
  mountToNode,
  unmountFromNode,
} from "DCGView";

export default class View {
  controller!: Controller;
  mountNode: HTMLElement | null = null;
  replaceView: MountedComponent | null = null;

  init(controller: Controller) {
    this.controller = controller;
  }

  initView() {
    if (this.mountNode !== null) {
      // already open
      return;
    }
    const searchBar = document.querySelector(".dcg-expression-search-bar");
    if (searchBar === null) {
      throw new Error("Search bar not found");
    }
    const searchContainer = document.createElement("div");
    searchContainer.style.display = "flex";
    searchContainer.style.flexDirection = "column";
    if (searchBar.parentNode === null) {
      throw new Error("Search bar parent node not found");
    }
    searchBar.parentNode.insertBefore(searchContainer, searchBar);
    searchContainer.appendChild(searchBar);
    this.mountNode = document.createElement("div");
    this.mountNode.className = "dsm-find-replace-expression-replace-bar";
    searchContainer.appendChild(this.mountNode);
    this.replaceView = mountToNode(ReplaceBar, this.mountNode, {
      controller: constArg(this.controller),
    });
  }

  destroyView() {
    if (this.mountNode === null) {
      // the view is already destroyed, so no need to throw an error
      return;
    }
    unmountFromNode(this.mountNode);
    this.mountNode = null;
    this.replaceView = null;
  }

  updateReplaceView() {
    this.replaceView?.update();
  }
}
