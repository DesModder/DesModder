import GraphMetadata, { Expression as MetadataExpression } from "../interface";
import { changeExprInMetadata, getBlankMetadata, getMetadata } from "../manage";
import { StateEffect, StateField } from "@codemirror/state";
import { Calc } from "globals/window";
import { pluginsEnabled } from "state/pluginsEnabled";

export const checkForMetadataChange = StateEffect.define<null>();
export const updateExprMetadata = StateEffect.define<{
  id: string;
  obj: Partial<MetadataExpression>;
}>();
export const duplicateMetadata = StateEffect.define<{
  fromID: string;
  toID: string;
}>();

export const metadata = StateField.define<GraphMetadata>({
  create: () => getBlankMetadata(),
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(checkForMetadataChange)) {
        const newMetadata = getMetadata();
        if (!transaction.startState.field(pluginsEnabled).get("GLesmos")) {
          if (
            Object.entries(newMetadata.expressions).some(
              ([id, e]) => e?.glesmos && !value.expressions[id]?.glesmos
            )
          ) {
            // list of glesmos expressions changed
            Calc.controller._showToast({
              message:
                "Enable the GLesmos plugin to improve the performance of some implicits in this graph",
            });
          }
        }
        if (JSON.stringify(newMetadata) !== JSON.stringify(value))
          value = newMetadata;
      } else if (effect.is(updateExprMetadata)) {
        const newMetadata = structuredClone(value);
        const { id, obj } = effect.value;
        value = changeExprInMetadataPure(newMetadata, id, obj);
      } else if (effect.is(duplicateMetadata)) {
        const { fromID, toID } = effect.value;
        const model = value.expressions[fromID];
        if (model) {
          const newMetadata = structuredClone(value);
          changeExprInMetadata(newMetadata, toID, model);
          value = newMetadata;
        }
      }
    }
    return value;
  },
});

function changeExprInMetadataPure(
  metadata: GraphMetadata,
  id: string,
  obj: Partial<MetadataExpression>
) {
  metadata = structuredClone(metadata);
  changeExprInMetadata(metadata, id, obj);
  return metadata;
}

export default [metadata];
