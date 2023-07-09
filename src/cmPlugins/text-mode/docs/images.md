# Images

An image just needs a name

```js
image "name"
```

This defaults to a 10×10 black square centered at the origin.

The real action happens in the style mapping

Expanding the "image" macro gives this full default, clearly written out

```js
image "Black Pixel" @{
  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBg+A8AAQQBAHAgZQsAAAAASUVORK5CYII=",
  width: 10,
  height: 10,
  center: (0, 0),
}
```

You can change the image by clicking the inline image preview (which defaults to a black square).

## Style Mapping

```js
image "Black Pixel" @{
  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBg+A8AAQQBAHAgZQsAAAAASUVORK5CYII=",
  width: 10,
  height: 10,
  center: (0, 0),
  angle: 0,
  opacity: 0.7,
  foreground: true,
  draggable: false,
  onClick: a -> a + 1,
  clickDescription: "Increment a",
  hoveredImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj0C+68x8ABM4CfceOo7cAAAAASUVORK5CYII=",
  depressedImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjsOhx+w8ABBQCCpNFiqIAAAAASUVORK5CYII=",
}
a = 0
```

The `clickDescription` is an accessibility feature for users who rely on screen readers.

The `hoveredImage` and `depressedImage` are of the same format as `url`, but they only change the image when `onClick` is an expression without errors.
