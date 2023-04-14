Procedure:

- Disable Show Tips and Set Primary Color
- 960x600 screen at 100% zoom (use responsive mode)
- Change username to "DesModder"
- `Ctrl+Shift+P` in DevTools then type "Screenshot" to capture
- If it's actually 1920x1200, run `convert filename.png -resize 66.67% filename.png` to downscale to 1280×800
  - bulk script: `for f in *.png; { convert $f -resize 66.67% $f; }`

Following are the graphs. Nested bullets are alt text (Firefox only):

- GLesmos: https://www.desmos.com/calculator/uum9ixgpgb
  - Utilize the GPU for high-performance plotting of complicated inequalities.
- Pin Expressions: https://www.desmos.com/calculator/6mxglcw2m7
  - Pin expressions to the top, so they can be viewed throughout the graph.
- Video Creator - Actions: https://www.desmos.com/calculator/orolqiiyfg
  - Record videos of your graph in motion, then save as MP4, GIF, APNG, or WEBM.
- Better Evaluation View: https://www.desmos.com/calculator/u25isysqgk
  - View special evaluation results better: NaN, infinity, lists, and color lists.
- Shift-Enter and Duplicate: https://www.desmos.com/calculator/de8zj6cwsq
  - Press Shift-Enter to type newlines in notes and folders. Also, Ctrl+Q to duplicate the current expression.
