import { jsx } from "#DCGView";
import { StaticMathQuillView } from "#components";
import {
  LabelOptionsBase,
  Private,
  TypedConstantValue,
  ValueType,
  ValueTypeMap,
} from "#globals";
import { autoCommands, autoOperatorNames } from "#utils/depUtils.ts";

const labelOptions = {
  smallCutoff: 0.00001,
  bigCutoff: 1000000,
  digits: 5,
  displayAsFraction: false,
} satisfies LabelOptionsBase;

type ComplexNumberLabel = typeof Private.Mathtools.Label.complexNumberLabel;
type PointLabel = typeof Private.Mathtools.Label.pointLabel;
type Point3dLabel = typeof Private.Mathtools.Label.point3dLabel;
type TruncatedLatexLabel = typeof Private.Mathtools.Label.truncatedLatexLabel;

const complexNumberLabel = (label: Parameters<ComplexNumberLabel>[0]) =>
  Private.Mathtools.Label.complexNumberLabel(label, labelOptions);
const pointLabel = (label: Parameters<PointLabel>[0]) =>
  Private.Mathtools.Label.pointLabel(label, labelOptions);
const point3dLabel = (label: Parameters<Point3dLabel>[0]) =>
  Private.Mathtools.Label.point3dLabel(label, labelOptions);
const truncatedLatexLabel = (label: Parameters<TruncatedLatexLabel>[0]) =>
  Private.Mathtools.Label.truncatedLatexLabel(label, labelOptions);

type ListValueType =
  | ValueType.ListOfComplex
  | ValueType.ListOfAny
  | ValueType.ListOfNumber
  | ValueType.ListOfBool
  | ValueType.ListOfPoint
  | ValueType.ListOfPoint3D
  | ValueType.EmptyList
  | ValueType.ListOfPolygon
  | ValueType.ListOfSegment
  | ValueType.ListOfCircle
  | ValueType.ListOfArc
  | ValueType.ListOfLine
  | ValueType.ListOfRay
  | ValueType.ListOfVector
  | ValueType.ListOfAngleMarker
  | ValueType.ListOfDirectedAngleMarker
  | ValueType.ListOfTransformation
  | ValueType.ListOfSegment3D
  | ValueType.ListOfTriangle3D
  | ValueType.ListOfSphere3D
  | ValueType.ListOfVector3D
  | ValueType.ListOfTone;

type TypedConstantIteratorValue<T extends ListValueType> = T extends T
  ? {
      valueType: T;
      iterator: ArrayIterator<ValueTypeMap[T][number]>;
    }
  : never;

function formatLabels<T extends ListValueType>(
  typedConstantValue: TypedConstantValue<T>
): IteratorObject<string> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const { valueType, iterator } = {
    valueType: typedConstantValue.valueType,
    iterator: typedConstantValue.value.values(),
  } as TypedConstantIteratorValue<T>;
  switch (valueType) {
    case ValueType.ListOfComplex:
      return iterator.map(complexNumberLabel);
    case ValueType.ListOfAny:
      return iterator.map(String);
    case ValueType.ListOfNumber:
      return iterator.map(truncatedLatexLabel);
    case ValueType.ListOfBool:
      return iterator.map((bool) => `\\mathrm{${bool}}`);
    case ValueType.ListOfPoint:
      return iterator.map(pointLabel);
    case ValueType.ListOfPoint3D:
      return iterator.map(point3dLabel);
    case ValueType.EmptyList:
      return iterator;
    case ValueType.ListOfPolygon:
      return iterator.map(
        (points) => `polygon\\left(${points.map(pointLabel).join(",")}\\right)`
      );
    case ValueType.ListOfSegment:
      return iterator.map(
        (points) => `segment\\left(${points.map(pointLabel).join(",")}\\right)`
      );
    case ValueType.ListOfCircle:
      return iterator.map(
        ([center, radius]) =>
          `circle\\left(${pointLabel(center)},${truncatedLatexLabel(radius)}\\right)`
      );
    case ValueType.ListOfArc:
      return iterator.map(
        (points) => `arc\\left(${points.map(pointLabel).join(",")}\\right)`
      );
    case ValueType.ListOfLine:
      return iterator.map(
        (points) => `line\\left(${points.map(pointLabel).join(",")}\\right)`
      );
    case ValueType.ListOfRay:
      return iterator.map(
        (points) => `ray\\left(${points.map(pointLabel).join(",")}\\right)`
      );
    case ValueType.ListOfVector:
      return iterator.map(
        (points) => `vector\\left(${points.map(pointLabel).join(",")}\\right)`
      );
    case ValueType.ListOfSegment3D:
      return iterator.map(
        (points) =>
          `segment\\left(${points.map(point3dLabel).join(",")}\\right)`
      );
    case ValueType.ListOfTriangle3D:
      return iterator.map(
        (points) =>
          `triangle\\left(${points.map(point3dLabel).join(",")}\\right)`
      );
    case ValueType.ListOfSphere3D:
      return iterator.map(
        ([center, radius]) =>
          `sphere\\left(${point3dLabel(center)},${truncatedLatexLabel(radius)}\\right)`
      );
    case ValueType.ListOfVector3D:
      return iterator.map(
        (points) => `vector\\left(${points.map(point3dLabel).join(",")}\\right)`
      );
    case ValueType.ListOfTone:
      return iterator.map(
        (values) =>
          `tone\\left(${values.map(truncatedLatexLabel).join(",")}\\right)`
      );
    default:
      return (iterator satisfies never).map(String);
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
        config={{
          autoCommands,
          autoOperatorNames: `${autoOperatorNames} polygon segment circle arc line ray vector sphere tone triangle`,
        }}
      />
    </div>
  );
}
