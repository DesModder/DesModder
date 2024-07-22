## Core Plugins

A Core Plugin is enabled before all other plugins and cannot be disabled.

Core Plugins are how DesModder handles modularizing functionality that:

- shouldn't be tied to a single toggleable plugin, such as if it's shared between several plugins, and
- requires mutable state or `.replacements`.
