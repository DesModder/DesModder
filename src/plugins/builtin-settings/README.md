# DesModder Template Plugin

How to use:

1. Create a new repository from this template with the green <kbd>Use this template</kbd> button above.
2. Follow the [development instructions of DesModder](https://github.com/jared-hughes/DesModder/#development) to get a fork of DesModder to your computer.
3. Add your new repository (constructed from this template) as a submodule using

```
git submodule add https://github.com/you/desmodder-your-plugin src/plugins/your-plugin
```

4. Search for the word `template` in the repository, and fix those items, including name, description, onEnable script, etc.
5. Add your plugin to `src/plugins.ts`
6. Your plugin should now appear in the DesModder plugin menu.
