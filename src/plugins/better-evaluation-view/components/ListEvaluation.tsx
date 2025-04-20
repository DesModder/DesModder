import { jsx } from "#DCGView";
import { StaticMathQuillView } from "#components";
import {
  LabelOptionsBase,
  Private,
  TypedConstantValue,
  ValueType,
  ValueTypeMap,
} from "#globals";

const labelOptions = {
  smallCutoff: 0.00001,
  bigCutoff: 1000000,
  digits: 5,
  displayAsFraction: false,
} satisfies LabelOptionsBase;

const { complexNumberLabel, pointLabel, point3dLabel, truncatedLatexLabel } =
  Private.Mathtools.Label;

type ListValueType =
  | ValueType.EmptyList
  | ValueType.ListOfNumber
  | ValueType.ListOfComplex
  | ValueType.ListOfPoint
  | ValueType.ListOfPoint3D;

type TypedConstantIteratorValue<T extends ListValueType> = T extends T
  ? {
      valueType: T;
      iterator: ArrayIterator<ValueTypeMap[T][number]>;
    }
  : never;

function formatLabels<T extends ListValueType>(
  typedConstantValue: TypedConstantValue<T>
) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const { valueType, iterator } = {
    valueType: typedConstantValue.valueType,
    iterator: typedConstantValue.value.values(),
  } as TypedConstantIteratorValue<T>;
  switch (valueType) {
    case ValueType.ListOfComplex:
      return iterator.map((label) => complexNumberLabel(label, labelOptions));
    case ValueType.ListOfPoint:
      return iterator.map((label) => pointLabel(label, labelOptions));
    case ValueType.ListOfPoint3D:
      return iterator.map((label) => point3dLabel(label, labelOptions));
    default:
      return iterator.map((label) => truncatedLatexLabel(label, labelOptions));
  }
}

// https://github.com/tc39/proposal-iterator-helpers/issues/296
// The result of the iterator helpers is an object with prototype %IteratorHelperPrototype%, which is a closable iterator.
// So take(n) implicitly calls the 'return' method and closes the iterator. This is unexpected when intending to access to the rest of the iterator.
function* reusableTake<T>(iterable: Iterator<T>, limit: number) {
  let i = 0;
  while (i++ < limit) {
    const result = iterable.next();
    if (result.done) break;
    yield result.value;
  }
}

export function ListEvaluation(val: () => TypedConstantValue<ListValueType>) {
  return (
    <div class="dcg-evaluation-view__wrapped-value">
      <StaticMathQuillView
        latex={() => {
          const typedConstantValue = val();
          const listLength = typedConstantValue.value.length;
          const truncationLength = 20;
          const labels = formatLabels(typedConstantValue);
          const labelsToShow = [...reusableTake(labels, truncationLength)];

          return `\\left[${labelsToShow.join(",")}${
            listLength > truncationLength
              ? `\\textcolor{gray}{...\\mathit{${listLength - truncationLength}\\ more}}`
              : ""
          }\\right]`;
        }}
      />
    </div>
  );
}
