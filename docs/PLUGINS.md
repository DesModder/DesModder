Each plugin lives in its own folder in `src/plugins/plugin-name`, and its main file should be `src/plugins/plugin-name/index.ts`. The `index.ts` file is where the plugin is set up and must export a single object that looks like the following:

```ts
interface Plugin<Settings extends GenericBooleanSettings = {}> {
  id: string;
  name: string;
  description: string;
  onEnable(config?: unknown): void;
  onDisable(): void;
  enabledByDefault: boolean;
  config?: readonly ConfigItem[];
  onConfigChange?(changes: Settings): void;
}
```

Based on this interface, a minimum plugin looks like

```ts
export default {
  id: "example-logger",
  name: "Example Logger Plugin",
  description: "Logs some information",
  onEnable: () => console.log("Enabled"),
  onDisable: () => console.log("Disabled"),
  enabledByDefault: true,
} as const;
```

## ID vs Name

The ID of a plugin should stay the same after it is first published to keep track of settings (such as if it is enabled).

The name should be human-readable and can change, if needed, for clarity.

## Description

Descriptions should complete the sentence "When installed, this plugin ..."

- first letter should be capitalized, and the description should end in a period.

For example,

(When installed, Video Creator) Lets you export videos and GIFs of your graphs based on simulations or sliders.

## `onEnable` and `onDisable`

Each plugin consists of an `onEnable` and `onDisable` hook. The `onDisable` function is only called when the plugin was enabled but the user taps the toggle to switch it to disabled.

Examples:

- If the plugin is disabled, `index.ts` is run at page load, but neither `onEnable` nor `onDisable` are called. If the user then toggles it on, `onEnable` is run.
- If the plugin is enabled, `index.ts` and `onEnable` are run at page load. If the user then toggles it off, `onDisable` is run.

The setting `enabledByDefault` only affects users when they first use DesModder.

## Configuration

The plugin builtin-settings is the only one that currently uses the configuration object, so look at its code if you want to use persistent settings. Take note that only boolean settings are currently supported.

## Graph dependencies?

DesModder currently has no [graph dependency](https://github.com/jared-hughes/DesModder/issues/58) plugins, so all graphs created through the extension are compatible with vanilla Desmos. A partial exception is GLesmos.
