# Statement

Statements are the core of graphs. They are all based around some math expression, with an optional style mapping and (for regressions) a regression value mapping.

The style mapping options below are listed divided by type of statement because many options are useless for other types. However, this is not currently enforced; unused options are often ignored without a warning.

As a reminder, press Ctrl+Space while inside a style mapping to preview some available options.

## Comparison (Equation or Inequality)

```js
// Equation
y = 2 * x + 5
sin(x) = sin(y)

// Inequality
y < 2 * x + 5
sin(x) * sin(y) >= 0
```

## Slider

```js
a = 5;
```

## Function Definition

```
f(x) = x + 1
f(a,b,c) = a + 2 * b + c
```

No styles are supported besides the default `id`, `pinned`, and `errorHidden`

## Visualizations

```
stats(L)
histogram(L)
boxplot(L)
dotplot(L)
independentTTest(L,M)
TTest(L)
```

TODO vizProps styles

## Regression

```js
a + 1 ~ sin(a)
residuals = y1 ~ a * x1 + b
y1 ~ a * x1 + b # {
  a = 2.3
  b = 4.7
}
```

## Constant calculations

```js
1 + 7/2 @{ displayEvaluationAsFraction: true }
```

## Style Mapping

### Lines, Points, and Fill

```js
y < 2 * x + 5 @{
  color: BLUE,
  // fill opacity
  fill: 0.5,
  lines: @{
    opacity: 0.5,
    width: 20,
    style: "DASHED"
  }
}
```

```js
(2, 3) @{
  color: "#c74440",
  points: @{
    opacity: 0.9,
    size: 9,
    style: "POINT",
    drag: "XY"
  },
}
```

Valid line styles are `"SOLID"` (default), `"DASHED"`, and `"DOTTED"`

Valid point styles are `"POINT"` (default), `"OPEN"`, and `"CROSS"`

Valid drag styles are `"AUTO"` (default), `"NONE"`, `"X"`, `"Y"`, and `"XY"`

### Slider styles

```js
a = 5 @{
  slider: @{
    playing: true,
    reversed: true,
    loopMode: "LOOP_FORWARD_REVERSE",
    // period is specified in milliseconds
    period: 8000,
    min: 0,
    max: 20,
    step: 1
  }
}
```

### Regression styles

```
y1 ~ a * b ^ x1 @{ logMode: true }
```
