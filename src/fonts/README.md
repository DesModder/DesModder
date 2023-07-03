Icons are from [Icomoon](https://icomoon.io/app/). The selection in `selection.json` can be loaded and extended through the "Import icons" button.

## Adding Icons

If you want to add icons, you can do that in Icomoon by doing the following:

1. Select the icons you want to add.
2. Click on the hamburger menu to the right of the `dsm-icons` section.
3. Click "Move Selection Here" to add the icons to the `dsm-icons` icon set.

## Exporting Icons

Do the following to export the icons from Icomoon:

1. Select all of the icons (shift-click the first one, shift-click the last one)
2. Click on "Generate Font" in the bottom right.
   - Make sure that the font sizes (shown on the right side) are all 24
3. Click the download button in the bottom right.
4. Replace the files in this directory:
   - `selection.json`: Apply Prettier and save.
   - `dsm-icons.woff`: Just swap in the new file
   - `style.css`: Remove the other two font-face `src`s from style.css, as we only use the `.woff` one. Apply Prettier and save.
