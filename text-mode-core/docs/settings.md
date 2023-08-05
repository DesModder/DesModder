# Settings

The settings item is where configuration happens for the whole graph.

The simplest settings has no options, but the runtime will typically fill in the viewport and random seed.

```js
settings @{}
```

```js
settings @{
  randomSeed: "fd0690aa6e28de4c9fad0830a5bff5d7",
  viewport: @{ xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
}
```

Most of the time, you don't need to edit the settings style mapping yourself. Panning and zooming will update it, as will manipulating any settings in the UI settings menu (wrench, top right).

## Style Mapping

Here's a full list of available options by example.

```js
settings @{
  viewport: @{
    xmin: -10,
    ymin: -10,
    xmax: 10,
    ymax: 10,
  },
  squareAxes: true,
  randomSeed: "abc",
  xAxisLabel: "x",
  yAxisLabel: "y",
  xAxisArrowMode: "BOTH",
  yAxisArrowMode: "BOTH",
  xAxisMinorSubdivisions: 2,
  yAxisMinorSubdivisions: 2,
  xAxisStep: 6.283185307179586,
  yAxisStep: 3,
  degreeMode: false,
  showGrid: true,
  showXAxis: true,
  showYAxis: true,
  xAxisNumbers: true,
  yAxisNumbers: true,
  polarMode: false,
  polarNumbers: false,
  restrictGridToFirstQuadrant: true,
  lockViewport: true,
}
```

`xAxisArrowMode` and `yAxisArrowMode` can be `"NONE"`, `"POSITIVE"`, or `"BOTH"`

`xAxisMinorSubdivisions` and `yAxisMinorSubdivisions` should be a positive integer

- x means x - 1 minor grid lines per major grid line
- In particular, 1 means no minor grid lines

Letting `xAxisStep` or `yAxisStep` be a small fractional multiple of pi (such as `pi/2` or `2*pi`) will write the steps in terms of pi.
