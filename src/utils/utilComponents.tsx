import { Component, jsx } from "#DCGView";
import { For } from "#components";

export class IndexFor<T> extends Component<{
  each: () => T[];
  key: (t: T) => string | number;
  children?: any;
}> {
  template() {
    const indexCache = new Map<string | number, number>();

    return (
      <For
        each={() => {
          indexCache.clear();
          return this.props.each().map((e, i) => {
            indexCache.set(this.props.key(e), i);
            return [e, () => indexCache.get(this.props.key(e))] as const;
          });
        }}
        key={([e]) => this.props.key(e)}
      >
        {(getPair: () => [T, () => number]) => {
          const [elem, index] = getPair();
          return this.props?.children(elem, index);
        }}
      </For>
    );
  }
}
