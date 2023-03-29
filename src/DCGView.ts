import { Fragile } from "globals/window";

export const DCGView = Fragile.DCGView;

type OrConst<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]: T[K] extends Function ? T[K] : T[K] | (() => T[K]);
};

type ToFunc<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]: T[K] extends Function ? T[K] : () => T[K];
};

export abstract class ClassComponent<PropsType = Props> {
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
        _element: {
          _domNode: HTMLElement;
        };
      };
}

type ComponentArgument = ClassComponent | (() => string);

export type LooseProps = Record<string, any>;

export type Props = Record<string, () => unknown>;

export interface MountedComponent {
  update: () => void;
}

abstract class ForComponent<T> extends ClassComponent<{
  each: Array<T>;
  key: (t: T) => string | number;
}> {}

interface IfElseSecondParam {
  true: () => typeof ClassComponent;
  false: () => typeof ClassComponent;
}

export interface DCGViewModule {
  Components: {
    For: typeof ForComponent;
    If: typeof ClassComponent;
    IfElse: (p: () => boolean, v: IfElseSecondParam) => typeof ClassComponent;
    // I don't know how to use the rest of these
    IfDefined: typeof ClassComponent;
    Input: typeof ClassComponent;
    Switch: typeof ClassComponent;
    SwitchUnion: typeof ClassComponent;
    Textarea: typeof ClassComponent;
  };
  Class: typeof ClassComponent;
  const: <T>(v: T) => () => T;
  createElement: (
    el: ComponentArgument,
    props: Props,
    ...children: ComponentArgument[]
  ) => unknown;
  // couldn't figure out type for `comp`, so I just put | any
  mountToNode: (
    comp: ClassComponent | any,
    el: HTMLElement,
    props: Props
  ) => MountedComponent;
  unmountFromNode: (el: HTMLElement) => void;
}

export const Component = DCGView.Class;
export const constArg = DCGView.const;
export const mountToNode = DCGView.mountToNode;
export const unmountFromNode = DCGView.unmountFromNode;

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
      li: any;
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

export function jsx(
  el: ComponentArgument,
  props: LooseProps,
  ...children: ComponentArgument[]
) {
  /* Handle differences between typescript's expectation and DCGView */
  if (!Array.isArray(children)) {
    children = [children];
  }
  // "Text should be a const or a getter:"
  children = children.map((e) =>
    typeof e === "string" ? DCGView.const(e) : e
  );
  for (const k in props) {
    // DCGView.createElement also expects 0-argument functions
    if (typeof props[k] !== "function") {
      props[k] = DCGView.const(props[k]);
    }
  }
  return DCGView.createElement(el, props, ...children);
}
