import { Component, jsx } from "#DCGView";
import { For } from "#components";

export class IndexFor<T> extends Component<{
  each: () => T[];
  key: (t: T) => string | number;
}> {
  template() {
    const indexCache = new Map<string | number, number>();

    return (
      <For
        each={() => {
          indexCache.clear();
          return this.props.each().map((e, i) => {
            indexCache.set(this.props.key(e), i);
            return [
              e,
              () => {
                return indexCache.get(this.props.key(e));
              },
            ] as const;
          });
        }}
        key={([e]) => this.props.key(e)}
      >
        {([e, index]: [T, () => number]) => {
          return (this.children as any)[0](e, index);
        }}
      </For>
    );
  }
}
