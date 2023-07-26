# Tables

Tables are a structuring mechanism for lists. You can think of them as folders restricted to lists.

The first list is implicitly treated as X values, with all other lists as Y values in their own expressions.

For example, consider the following table:

```js
L = [12, 13, 14]
table {
  x1 = [1, 2, 3]
  y1 = [4, 5, 6]
  [7, 8, 9]
  [10, 11, NaN]
  L
}
```

It is effectively equivalent to a folder

```js
L = [12, 13, 14]
folder "title" {
  x1 = [1, 2, 3]
  y1 = [4, 5, 6]
  (x1, y1)
  (x1, [7, 8, 9])
  (x1, [10, 11])
  (x1, L)
}
```

(Note that the trailing `NaN` got removed))

Tables are not too useful in Text Mode because of this equivalence. They are kept mostly for compatibility with vanilla Desmos.

However, tables have one property that is impossible to repeat elsewhere: lists of draggable poitns can be obtained with the following code:

```js
table {
  X = [1, 2, 3]
  Y = [4, 5, 6] @{
    points: @{ drag: "XY" },
  }
}
```

## Style Mapping

The entire table can have a style mapping, which just supports the standard `pinned`, `secret`, and `id`.

The style mappings for columns after the first are more detailed

```js
table {
  X = [1, 2, 3]
  Y = [4, 5, 6] @{
    color: BLUE,
    hidden: false,
    points: @{
      opacity: 0.5,
      size: 20,
      style: "CROSS",
      drag: "NONE"
    },
    lines: @{
      opacity: 0.4,
      width: 10,
      style: "SOLID"
    }
  }
}
```

Valid line styles are `"SOLID"` (default), `"DASHED"`, and `"DOTTED"`

Valid point styles are `"POINT"` (default), `"OPEN"`, and `"CROSS"`

Valid drag styles are `"AUTO"` (default), `"NONE"`, `"X"`, `"Y"`, and `"XY"`
