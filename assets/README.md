Asset sources:

- https://www.desmos.com/calculator/ul4fvvup6m to get a png
- Inkscape "Path > trace bitmap" on that png (much simpler output than an svg `asyncScreenshot`), then position correctly, to get an svg
- `logo.svg`: Take the previous thing and add a white filled in circle (see `id="white-disc"`)
- `desmodder.png`: Run `convert -background none logo.svg desmodder.png`

In /public:

- icon128.png, icon48.png: scale `desmodder.png` to needed size
