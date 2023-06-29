Icons are from [Icomoon](https://icomoon.io/app/). The selection in `selection.json` can be loaded and extended through the "Import icons" button.

If you want to add icons, you can do that in icomoon by doing the following:

1. Select the icons you want to add.
2. Click on the hamburger menu to the right of the `dsm-icons` section.
3. Click "Duplicate Selection Here" to add the icons to the `dsm-icons` icon set.

Do the following to export the icons from icomoon:

1. Click on the `dsm-icons` hamburger menu.
2. Click "Download JSON" to get a new selection so that maintainers can add more icons in the future.
3. Click on "Generate Font" in the bottom right.
4. Click the download button in the bottom right.
5. Replace the files in this directory as needed. You may need to remove the additional font-face `src`s from style.css, as we only use the .woff one.
