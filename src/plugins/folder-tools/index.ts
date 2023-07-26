import { PluginController } from "../PluginController";
import { ActionButton } from "../expr-action-buttons";
import { ItemModel } from "globals/models";
import { Calc } from "globals/window";
import { List } from "utils/depUtils";

export default class FolderTools extends PluginController {
  static id = "folder-tools" as const;
  static enabledByDefault = true;

  actionButtons: ActionButton[] = [
    {
      tooltip: "folder-tools-enclose",
      buttonClass: "dsm-note-enclose-button",
      iconClass: "dsm-icon-folder-plus",
      onTap: (model) => this.noteEnclose(model.index),
      predicate: (model) => model.type === "text",
    },
    {
      tooltip: "folder-tools-dump",
      buttonClass: "dsm-folder-dump-button",
      iconClass: "dsm-icon-folder-minus",
      onTap: (model) => this.folderDump(model.index),
      predicate: (model) =>
        model.type === "folder" &&
        Calc.controller.getItemModelByIndex(model.index + 1)?.folderId ===
          model.id,
    },
    {
      tooltip: "folder-tools-merge",
      buttonClass: "dsm-folder-merge-button",
      iconClass: "dsm-icon-folder-plus",
      onTap: (model) => this.folderMerge(model.index),
      predicate: (model) => model.type === "folder",
    },
  ];

  folderDump(folderIndex: number) {
    const folderModel = Calc.controller.getItemModelByIndex(folderIndex);
    if (!folderModel || folderModel.type !== "folder") return;
    const folderId = folderModel?.id;

    // Remove folderId on all of the contents of the folder
    for (
      let currIndex = folderIndex + 1,
        currExpr = Calc.controller.getItemModelByIndex(currIndex);
      currExpr && currExpr.type !== "folder" && currExpr?.folderId === folderId;
      currIndex++, currExpr = Calc.controller.getItemModelByIndex(currIndex)
    ) {
      currExpr.folderId = undefined;
    }

    // Replace the folder with text that has the same title
    const T = Calc.controller.createItemModel({
      id: Calc.controller.generateId(),
      type: "text",
      text: folderModel.title,
    });
    Calc.controller._toplevelReplaceItemAt(folderIndex, T, true);

    this.dsm.commitStateChange(true);
  }

  folderMerge(folderIndex: number) {
    const folderModel = Calc.controller.getItemModelByIndex(folderIndex);
    const folderId = folderModel?.id;

    // type cast beacuse Desmos has not yet updated types for authorFeatures
    const skipAuthors = !(Calc.settings as any).authorFeatures;

    let newIndex = folderIndex;
    let currIndex = folderIndex;
    let currExpr: ItemModel | undefined;
    // we might want to delete the folder heading immediately after this folder
    // at most one; keep track if we've seen any expressions since the end of
    // this folder, so we only delete a folder with no expressions in between
    let movedAny = false;
    // Keep track of if we've deleted a folder
    let toDeleteFolderID = "";
    // Place all expressions until the next folder into this folder
    while (true) {
      newIndex++;
      currIndex++;
      currExpr = Calc.controller.getItemModelByIndex(currIndex);
      if (currExpr === undefined) break;
      // If authorFeatures is disabled, skip secret folders
      if (skipAuthors) {
        while (currExpr?.type === "folder" && currExpr.secret) {
          const secretID: string = currExpr.id;
          do {
            currIndex++;
            currExpr = Calc.controller.getItemModelByIndex(currIndex);
          } while (
            currExpr &&
            currExpr.type !== "folder" &&
            currExpr.folderId === secretID
          );
        }
        if (currExpr === undefined) break;
      }
      if (currExpr.type === "folder") {
        if (!movedAny) {
          // This is a folder immediately after the end of our starting folder
          // Mark it to delete, and move on.
          newIndex--;
          movedAny = true;
          toDeleteFolderID = currExpr.id;
        } else break;
      } else if (currExpr.folderId !== folderId) {
        if (toDeleteFolderID && !currExpr.folderId) break;
        movedAny = true;
        // Actually move the item into place
        currExpr.folderId = folderId;
        List.moveItemsTo(Calc.controller.listModel, currIndex, newIndex, 1);
      }
    }
    if (toDeleteFolderID)
      List.removeItemById(Calc.controller.listModel, toDeleteFolderID);

    this.dsm.commitStateChange(true);
  }

  noteEnclose(noteIndex: number) {
    // Replace this note with a folder, then folderMerge
    const noteModel = Calc.controller.getItemModelByIndex(noteIndex);
    if (!noteModel || noteModel.type !== "text") return;

    const T = Calc.controller.createItemModel({
      id: Calc.controller.generateId(),
      type: "folder",
      title: noteModel.text,
    });
    Calc.controller._toplevelReplaceItemAt(noteIndex, T, true);
    this.folderMerge(noteIndex);

    this.dsm.commitStateChange(true);
  }
}
