# Folders

Folders are a structuring mechanism. Each folder must have a title specified as a string, and they may contain any statement except for another folder (nested folders are not yet supported)

```js
folder "Basic trig functions!" {
  y = sin(x)
  y = cos(x)
  y = tan(x)
}
```

## Style Mapping

```js
folder "title" {
  a = 3
  y = a * x
} @{
  hidden: true,
  collapsed: true
}
```

Collapsed doesn't make sense in the context of text mode because they don't actually collapse the text representation of the folder (folders can be collapsed using the text editor, just like tables, style mappings, and similar constructs)
