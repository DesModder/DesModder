import { Fragile } from "#globals";
import { createElementWrapped } from "./preload/replaceElement";

export const { DCGView } = Fragile;

export type OrConst<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] | (() => T[K]);
};

type ToFunc<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : () => T[K];
};

export abstract class ClassComponent<
  PropsType extends GenericProps = Record<string, unknown>,
> {
  props!: ToFunc<PropsType>;
  children!: unknown;
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_props: OrConst<PropsType>) {}
  init(): void {}
  abstract template(): unknown;
  _element!:
    | {
        _domNode: HTMLElement;
      }
    | {
        _domNode: undefined;
        _element: {
          _domNode: HTMLElement;
        };
      };
}

export interface MountedComponent {
  update: () => void;
}

abstract class IfComponent extends ClassComponent<{
  predicate: () => boolean;
}> {}

abstract class ForComponent<T> extends ClassComponent<{
  each: () => Array<T>;
  key: (t: T) => string | number;
}> {}

export interface IfElseSecondParam {
  true: () => ComponentChild;
  false: () => ComponentChild;
}

abstract class InputComponent extends ClassComponent<{
  value: () => string;
  onInput: (s: string) => void;
  required: boolean;
  placeholder: string;
  spellcheck: boolean;
}> {}

/** Switch expects one child which is a function returning a component */
abstract class SwitchComponent extends ClassComponent<{
  key: () => any;
}> {}

export interface DCGViewModule {
  Components: {
    For: typeof ForComponent | { Keyed: typeof ForComponent };
    If: typeof IfComponent;
    Input: typeof InputComponent;
    Switch: typeof SwitchComponent;
    SwitchUnion: <Key extends string>(
      discriminant: () => Key,
      branches: Record<Key, () => ComponentChild>
    ) => ComponentTemplate;
    IfElse: (p: () => boolean, v: IfElseSecondParam) => ComponentTemplate;
  };
  Class: typeof ClassComponent;
  const: <T>(v: T) => () => T;
  createElement: <Props extends GenericProps>(
    comp: ComponentConstructor<Props>,
    props: WithCommonProps<ToFunc<Props>>
  ) => ComponentTemplate;
  // couldn't figure out type for `comp`, so I just put | any
  mountToNode: <Props extends GenericProps>(
    comp: ComponentConstructor<Props>,
    el: HTMLElement,
    props: WithCommonProps<ToFunc<Props>>
  ) => MountedComponent;
  unmountFromNode: (el: HTMLElement) => void;
}

export type ComponentConstructor<Props extends GenericProps> =
  | string
  | typeof ClassComponent<Props>;
// export type GenericProps = Record<string, (...args: any[]) => any>;
type GenericProps = any;
interface CommonProps {
  class?: () => string;
  didMount?: (elem: HTMLElement) => void;
  willUnmount?: () => void;
  children?: ComponentChild[];
}
type WithCommonProps<T> = Omit<T, keyof CommonProps> & CommonProps;
export interface ComponentTemplate {
  __nominallyComponentTemplate: undefined;
}
export type ComponentChild = ComponentTemplate | null | string | (() => string);

export const { Class: Component, mountToNode, unmountFromNode } = DCGView;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicAttributes {
      class?: string | Record<string, boolean>;
    }
    interface IntrinsicElements {
      div: any;
      i: any;
      span: any;
      img: any;
      p: any;
      a: any;
      input: any;
      label: any;
      strong: any;
      ul: any;
      ol: any;
      li: any;
      table: any;
      tr: any;
      th: any;
      td: any;
      button: any;
      br: any;
    }
  }
}

/**
 * If you know React, then you know DCGView.
 * Some exceptions:
 *  - DCGView was forked sometime in 2016, before React Fragments and some other features
 *  - use class instead of className
 *  - there's some function name changes, like React.Component → DCGView.Class,
 *    rerender → template.
 *    However, there are functional differences:
 *    template is only called once with the prop values, see the next point.
 *  - You don't want to write (<div color={this.props.color()}>...) because the prop value is
 *    executed only once and gives a fixed value. If that is what you want,
 *    it is more semantic to do (<div color={DCGView.const(this.props.color())}>...),
 *    but if you want the prop to change on component update, use
 *    (<div color={() => this.props.color()}>...</div>)
 *  - This wrapper automatically calls DCGView.const over bare non-function values,
 *    so be careful. Anything that needs to change should be wrapped in a function
 *  - DCGView or its components impose some requirements, like aria-label being required
 * I have not yet figured out how to set state, but most components should be
 * stateless anyway (state control in Model.js)
 */

export function jsx<Props extends GenericProps>(
  el: ComponentConstructor<Props>,
  props: OrConst<Props>,
  ...children: ComponentChild[]
) {
  /* Handle differences between typescript's expectation and DCGView */
  if (!Array.isArray(children)) {
    children = [children];
  }
  // "Text should be a const or a getter:"
  children = children.map((e) =>
    typeof e === "string" ? DCGView.const(e) : e
  );
  const fnProps = {} as any;
  for (const k in props) {
    // DCGView.createElement also expects 0-argument functions
    if (typeof props[k] !== "function") {
      fnProps[k] = DCGView.const(props[k]);
    } else {
      fnProps[k] = props[k] as (...args: any[]) => any;
    }
  }
  fnProps.children = children.length === 1 ? children[0] : children;
  return createElementWrapped(el, fnProps);
}
