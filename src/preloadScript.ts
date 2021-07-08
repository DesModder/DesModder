import window from "globals/window";

/* This script is loaded at document_start, before the page's scripts, to give it 
time to set ALMOND_OVERRIDES and replace module definitions */

/* As an example, we override the definition of sin(x) in core/math/builtin */
const workerInject = `
const defineOverrides = {
  "core/math/builtin": (definition) =>
    eval(
      "_makeFunctionStatement=" +
        definition.toString().replace(/\.sin=.,/, ".sin=(x)=>x*x,")
    ),
};

const oldDefine = define;

function newDefine(moduleName, dependencies, definition) {
  if (moduleName in defineOverrides) {
    const override = defineOverrides[moduleName](definition, dependencies);
    definition = override.definition ?? override;
    dependencies = override.dependencies ?? dependencies;
  }
  return oldDefine(moduleName, dependencies, definition);
}
newDefine.amd = {
  jQuery: true,
};

define = newDefine;`;

/* As an example, we inject the above worker code and replace "A" with "B" in the settings view*/
const defineOverrides = {
  // replace the first newline (which should be immediately after the definition of define and require
  "text!worker_src_underlying": (definition: () => string) => () =>
    definition().replace("\n", `${workerInject}\n`),
  "main/settings-view": (definition: Function) =>
    Function(
      "return " +
        definition.toString().replace(/\.const\("A"\)/g, '.const("B")')
    )(),
} as {
  [key: string]: (definition: any, dependencies: string[]) => Function;
};

// assumes `oldDefine` is defined before `newDefine` is needed
let oldDefine!: typeof window["define"];

function newDefine(
  moduleName: string,
  dependencies: string[],
  definition: Function
) {
  if (moduleName in defineOverrides) {
    // override should either be `{dependencies, definition}` or just `definition`
    const override = defineOverrides[moduleName](definition, dependencies);
    definition = override;
  }
  return oldDefine(moduleName, dependencies, definition);
}

// without this, you get Error: touchtracking missing jquery
newDefine.amd = {
  jQuery: true,
};

if (window.ALMOND_OVERRIDES !== undefined) {
  window.alert(
    "Warning: you have a script installed that overrides modules definitions. " +
      "This is incompatible with some features of DesModder, " +
      "so try disabling Tampermonkey scripts."
  );
}
// trick to override `define`s
window.ALMOND_OVERRIDES = new Proxy(
  {},
  {
    get(target, prop, receiver) {
      if (prop === "define") {
        oldDefine = window.define;
        return newDefine;
      } else {
        return Reflect.get(target, prop, receiver);
      }
    },
  }
);
