## Setup Environment

1. Remove the existing extension to avoid conflict. If you plan to be editing DesModder, I suggest opening a [separate Chrome profile](https://support.google.com/chrome/answer/2364824) so that you still have the stable extension in your main profile when you need it.
2. Make sure you have `git` and `npm` installed.

- Check that `npm --version` is at least `7.0.0` to avoid issues with overwriting the lockfile.

3. Run `git clone https://github.com/DesModder/DesModder` to download the latest commit
4. Navigate to the directory, then run `npm run init` to setup hooks and install dependencies
5. Run `npm run build` to build.
6. Load the unpacked extension in the `dist/` folder through the directions at https://developer.chrome.com/docs/extensions/mv2/getstarted/#manifest (see "load unpacked")

## Making Changes

First follow the instructions above in "Setup Environment".

1. You will want the Prettier and Typescript packages installed for your editor.
   - For Atom, these are `prettier-atom` and `atom-typescript`
   - VS Code comes bundled with Typescript support. Its Prettier extension is called "Prettier - Code Formatter," and I suggest the settings
     ```
     "editor.formatOnSave": true,
     "[typescript]": {
         "editor.defaultFormatter": "esbenp.prettier-vscode"
     }
     ```
2. [Fork](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) the DesModder repository to your GitHub account
3. Repeat the [Setup](#Setup) directions with your forked repository instead of the main GitHub repository
4. Clone and open your fork of the DesModder directory in your editor.
5. For this example, open the file `src/plugins.ts`.
6. To test Prettier, find the line that starts `const _plugins = {`, and add an extra newline after the opening brace. Prettier should automatically remove that unneeded newline on save.
7. To test Typescript, remove the `.id` from the next line. Typescript should tell you "A computed property name must be of type 'string', 'number', 'symbol', or 'any'."
8. If both of these worked, then you are ready to start development. Run `npm run dev` in the DesModder directory to start the development server. There should hopefully be no errors. If there is a prettier error, run `npm run fix:prettier`
9. You should have loaded the unpacked extension based on the instructions in "Setup Environment." Check that it works by opening https://desmos.com/calculator.
10. Back in `src/plugins.ts`, delete one of the lines declaring a plugin, for example delete `[duplicateHotkey.id]: duplicateHotkey,`
11. Refresh the Desmos page. The plugin should now be removed from the list.

## Example: Creating a plugin

In this section, we will create a plugin which will simply change the displayed username in the top-right.

All the code changes are visible at https://github.com/DesModder/DesModder/compare/main...example-plugin-change-username.

1. You should already have a fork of DesModder cloned to your computer
2. Create a new branch named "plugin-change-username" using `git checkout -b plugin-change-username`
3. In the directory `src/plugins`, add a new directory called `change-username` and a file `src/plugins/change-username/index.ts` with the following contents:

   ```ts
   import { Plugin } from "plugins";

   function getHeaderElement(): HTMLElement | null {
     return document.querySelector(".header-account-name");
   }

   let oldName = "";

   function onEnable() {
     const headerElement = getHeaderElement();
     if (headerElement === null) return;
     const text = headerElement.innerText;
     if (text !== undefined) oldName = text;
     headerElement.innerText = "DesModder ♥";
   }

   function onDisable() {
     const headerElement = getHeaderElement();
     if (headerElement === null) return;
     headerElement.innerText = oldName;
   }

   const changeUsername: Plugin = {
     id: "change-username",
     onEnable,
     onDisable,
     enabledByDefault: false,
   };
   export default changeUsername;
   ```

4. Setup the displayed name. This is managed in the Fluent file `localization/en.ftl`. Add some lines at the bottom. These are of the form `[pluginID]-name` and `[pluginID]-desc`:

   ```
   ## Change Username
   change-username-name = Change Username
   change-username-desc = Renames the displayed username in the top-right
   ```

5. Load the plugin: In `src/plugins/index.ts`, add `import changeUsername from "plugins/change-username/index"` near the top and `[changeUsername.id]: changeUsername,` in `_plugins` near the bottom of the file.
6. Add the plugin to the menu: in `src/components/Menu.tsx`, add the plugin ID `"change-username"` to the category list `visual` in `categoryPlugins`.
   - after reloading the webpage (assuming you're running `npm run dev`), a new plugin should appear in the list in [desmos.com/calculator](https://desmos.com/calculator).
7. Commit the changes to your fork
   - `git add .`
   - `git commit -m "Add Plugin 'Change Username'"`
   - `git push`
8. For an actual plugin, you would do some more testing and eventually open a pull request on the repository. Run `npm run test` and `npm run lint` before submitting the PR to ensure that it will meet automated checks. You can fix some problems automatically with `npm run fix`.

## Example: Creating a new translation file

Before creating translations, figure out the language code for the language. At time of writing, vanilla Desmos has support for: en, es, et, ru, da, de, pt-BR, pt-PT, ca, fr, it, is, nl, no, sv-SE, hu, cs, pl, id, vi, el, uk, ka, th, tr, zh-CN, zh-TW, ko, ja.

The following examples will refer to the language code `fr` (French), but replace it with your language code.

1. Create a new FTL (fluent) file by duplicating `localization/en.ftl` to `localization/fr.ftl`
2. Add a line near the top of `src/i18n/i18n-core.ts` with an import statement, e.g. `import frFTL from "../../localization/fr.ftl";`
3. Add a line at the bottom of `src/i18n/18n-core.ts` adding the imported language, e.g. `addLanguage("fr", frFTL)`
4. Edit some strings in the `localization/fr.ftl` file
5. Follow the directions in "Making Changes" to run `npm run dev` to view changes on each reload of the page.

If you want to check for mistakes, run `npm run audit-langs fr`.

[Project Fluent documentation](https://projectfluent.org/fluent/guide/)
