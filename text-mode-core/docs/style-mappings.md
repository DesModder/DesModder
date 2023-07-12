# Style Mappings

Text Mode doesn't rely on a varity of UIs for styles; instead it uses a consistent style mapping syntax. A style mapping starts with `@{` and ends with `}`. Each entry in the mapping is of the form `property_name: value`, and they must be comma-separated.

Style mappings are used mostly for style-related options, such as color, size, opacity, visibility, label placement, image size, etc.

For example, the following Text Mode code creates a 25-pixel-wide blue line with opacity 0.5.

```js
y = x @{
  color: BLUE,
  lines: @{ width: 25, opacity: 0.5 },
}
```

Style mappings are also used for functional options, such as IDs, slider bounds, drag modes, etc.

```js
a = 3 @{
  id: "1",
  slider: @{ min: 2, max: 8, step: 1 }
}
(a, 0) @{
  points: @{ drag: "AUTO" },
}
```

Style mappings can be applied to all item types. Every item type supports the `id: string` and `secret: boolean` properties, and most (statements, tables, images, text) support `pinned: boolean`. For more specific options, see each item type article:

- [statements](./statements.md#style-mapping)
- [folders](./folders.md#style-mapping)
- [tables and columns](./tables.md#style-mapping)
- [images](./images.md#style-mapping)
- [text](./text.md#style-mapping)
- [settings](./settings.md#style-mapping)
- [tickers](./tickers.md#style-mapping)
