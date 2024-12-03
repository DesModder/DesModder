Each plugin lives in its own folder in `src/plugins/plugin-name`, and its main file should be `src/plugins/plugin-name/index.ts`. The `index.ts` file is where the plugin is set up and must export a single class. A minimal plugin is

```ts
export default class ExampleLogger extends PluginController {
  static id = "example-logger" as const;
  static enabledByDefault = false;

  afterEnable() {
    console.log("Enabled");
  }

  afterDisable() {
    console.log("Disabled");
  }
}
```

## Name and Description

Each plugin must have a name and description. These are specified by adding two translation entries to `localization/en.ftl` with `ID-name` and `ID-desc`, e.g.

```ftl
## Example Logger
example-logger-name = Example Logger
example-logger-desc = Logs a message when enabled or disabled
```

Descriptions (at least in English) should complete the sentence "When installed, this plugin ..."

- first letter should be capitalized, and the description should end in a period.

For example,

(When installed, Video Creator) Lets you export videos and GIFs of your graphs based on simulations or sliders.

### ID vs Name

The ID of a plugin should stay the same after it is first published to keep track of settings (such as if it is enabled).

The name should be human-readable and can change, if needed, for clarity.

## Lifetimes hooks: `afterEnable`, and `afterDisable`

The `afterEnable` method is called whenever the plugin starts up: either on page load or after the user enables the plugin after it was disabled.

If you do something in the class constructor instead of `afterEnable`, be careful: At the time of construction, the plugin is not yet added to the plugin map, so external functions will think the plugin is disabled.

The `afterDisable` method is only called when the plugin was enabled but the user taps the toggle to switch it to disabled.

The setting `enabledByDefault` only affects users when they first use DesModder.

## Settings: `afterConfigChange`

Plugin settings are managed by the main DesModder controller. Specify the static `config` property to determine what settings are shown to the user. Then the main controller will ensure that the instance `.settings` field is always updated to the current value of the settings.

Use the `afterConfigChange` method if you need to do something when the settings changes.

## Graph dependencies?

DesModder has no "graph dependency" plugins, so all graphs created through the extension are compatible with vanilla Desmos. A partial exception is GLesmos.
