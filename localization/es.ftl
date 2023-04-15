# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Harcdoded in the Typescript:
# [pluginID]-name = Name
# [pluginID]-desc = Description
# [pluginID]-opt-[optionKey]-name = Option Name
# [pluginID]-opt-[optionKey]-desc = Option Description

## General
menu-learn-more = Aprender más
menu-desmodder-plugins = Plugins de DesModder
menu-desmodder-tooltip = Menú de DesModder

## Category names
category-core-name = Funciones Básicas
category-utility-name = Utilidades
category-visual-name = Apariencia
category-integrations-name = Integraciones

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = Genera funciones implícitas en la GPU. Se deshabilita cuando la pagina es refrescada. Puede ralentizar la interfaz grafica o en raras ocaciones puede congelar la página. Recarga la página si te causa problemas.
GLesmos-label-toggle-glesmos = Generar gráfica con GLesmos
GLesmos-confirm-lines = Confimar lineas
GLesmos-confirm-lines-body = Generar lineas con GLesmos puede ser lento. Sé especialmente cuidadoso cuando utlizes listas.
# Missing: error messages

## Tips
show-tips-name = Mostrar consejos
show-tips-desc = Muestra consejos hasta abajo de la lista de expresiones.
# Missing: all tips. Is it worthwhile?

## Text Mode
text-mode-name = Modo Texto BETA
text-mode-desc = Errores son esperados. Documentación temporal:
text-mode-toggle = Alternar Modo Texto
# Missing: error messages

## Debug Mode
debug-mode-name = Modo de Depuración
debug-mode-desc = Muestra los IDs de las expresiones en lugar de los indices.

## Find and Replace
find-and-replace-name = Buscar y Reemplazar
find-and-replace-desc = Agrega un botón de "reemplazar todo" en el menu de busqueda con Ctrl+F y te permite cambiar fácilmente nombres de variables o de funciones.
find-and-replace-replace-all = reemplazar todo

## Wolfram To Desmos
wolfram2desmos-name = De Wolfram a Desmos
wolfram2desmos-desc = Te permite pegar texto de ecuaciones en formato ASCII (así como las busquedas en Wolfram Alpha) en Desmos.
wolfram2desmos-opt-reciprocalExponents2Surds-name = Notación Radical
wolfram2desmos-opt-reciprocalExponents2Surds-desc = Convierte exponentes fraccionales menores de uno a su equivalente en radical.
wolfram2desmos-opt-derivativeLoopLimit-name = Expandir derivadas
wolfram2desmos-opt-derivativeLoopLimit-desc = Expande las derivadas de orden superior en notación de Leibniz en forma de derivadas anidadas (limite de 10).

## Pin Expressions
pin-expressions-name = Fijar Expresiones
pin-expressions-desc = Fija expresiones desde modo de Editar Lista
pin-expressions-pin = Fijar
pin-expressions-unpin = Desfijar

## Builtin Settings
builtin-settings-name = Configuración de Calculadora
builtin-settings-desc = Te permite alternar las funciones integradas en Desmos. Most options apply only to your own browser and are ignored when you share graphs with others.
builtin-settings-opt-advancedStyling-name = Advanced styling
builtin-settings-opt-advancedStyling-desc = Enable label editing, show-on-hover, text outline, and one-quadrant grid
builtin-settings-opt-graphpaper-name = Graphpaper
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = Author features
builtin-settings-opt-authorFeatures-desc = Toggle hidden folders, toggle readonly, and more
builtin-settings-opt-pointsOfInterest-name = Show points of interest
builtin-settings-opt-pointsOfInterest-desc = Intercepts, holes, intersections, etc.
builtin-settings-opt-trace-name = Trace along curves
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = Show Expressions
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = Show Zoom Buttons
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Show Expressions Top Bar
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = Border
builtin-settings-opt-border-desc = Subtle border around the calculator
builtin-settings-opt-keypad-name = Show keypad
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = QWERTY Keyboard
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Duplicate Expression Hotkey
duplicate-expression-hotkey-desc = Type Ctrl+Q or Ctrl+Shift+Q to duplicate the selected expression.

## Right Click Tray
right-click-tray-name = Right Click Tray
right-click-tray-desc = Allows settings tray to be opened with a right click instead of holding left click on the settings bubble

## Set Primary Color
set-primary-color-name = Set Primary Color
set-primary-color-desc = Choose the primary color for the user interface
set-primary-color-opt-primaryColor-name = Primary Color
set-primary-color-opt-primaryColor-desc = Primary color across the calculator
set-primary-color-opt-doFavicon-name = Update Site Icon
set-primary-color-opt-doFavicon-desc = Toggle updating the site icon

## Hide Errors
hide-errors-name = Hide Errors
hide-errors-desc = Click error triangles to fade them and hide suggested sliders.
hide-errors-hide = Hide

## Folder Tools
folder-tools-name = Folder Tools
folder-tools-desc = Adds buttons in edit-list-mode to help manage folders.
folder-tools-dump = Dump
folder-tools-merge = Merge
folder-tools-enclose = Enclose

## Video Creator
video-creator-name = Video Creator
video-creator-desc = Lets you export videos and GIFs of your graphs based on actions or sliders.
video-creator-menu = Video Creator Menu
video-creator-to = to
video-creator-step = , step
video-creator-ticks-step = Time step (ms):
video-creator-prev-action = Prev
video-creator-next-action = Next
video-creator-size = Size:
video-creator-step-count = Step count:
video-creator-target-same-pixel-ratio = Target same pixel ratio
video-creator-target-tooltip = Adjusts scaling of line width, point size, label size, etc.
video-creator-ffmpeg-loading = FFmpeg loading...
video-creator-ffmpeg-fail = If this doesn't work in the next few seconds, try reloading the page or reporting this bug to DesModder devs.
video-creator-exporting = Exporting...
video-creator-cancel-capture = Cancel
video-creator-cancel-export = Cancel
video-creator-capture = Capture
video-creator-preview = Preview
video-creator-delete-all = Delete all
video-creator-filename-placeholder = set a filename
video-creator-export = Export
video-creator-export-as = Export as { $fileType }
video-creator-fps = FPS:
video-creator-method-once = once
video-creator-method-slider = slider
video-creator-method-action = action
video-creator-method-ticks = ticks

## Shift+Enter Newline
shift-enter-newline-name = Shift+Enter Nueva línea 
shift-enter-newline-desc = Usa Shift+Enter para teclear líneas nuevas en las notas y los títulos de imágenes/carpetas.

## Wakatime
wakatime-name = WakaTime
wakatime-desc = Mira tu actividad en Desmos en WakaTime.com
wakatime-opt-secretKey-name = Llave Secreto
wakatime-opt-secretKey-desc = Llave API usado para los servidores de WakaTime
wakatime-opt-splitProjects-name = Separa los Prollectos por cada gráfica
wakatime-opt-splitProjects-desc = Guarda cada gráfica como su misma proyecto, y no como branchas de un Proyecto de Desmos unido
wakatime-opt-projectName-name = Nombre de Proyecto
wakatime-opt-projectName-desc = Visible en WakaTime, y compartido por todos tus proyectos Desmos 


## Performance Display
performance-info-name = Visualizador de Rendimiento
performance-info-desc = Visualiza información sobre la rendimiento del gráfico.
performance-info-refresh-graph = Refrescar el Gráfico
performance-info-refresh-graph-tooltip = Refresca el gráfico para pruebar el tiempo de carga.
performance-info-sticky-tooltip = Mantén el menú abierto 
performance-info-time-in-worker = Tiempo En Trabajador
performance-info-compiling = Compilando
performance-info-rendering = Visualizando
performance-info-other = Otro

## Better Evaluation View
better-evaluation-view-name = Better Evaluation View
better-evaluation-view-desc = Displays list elements, colors, and undefined values
better-evaluation-view-opt-lists-name = Show list elements
better-evaluation-view-opt-lists-desc = Show list elements instead of list length
better-evaluation-view-opt-colors-name = Show colors
better-evaluation-view-opt-colors-desc = Show colors as rgb values
better-evaluation-view-opt-colorLists-name = Show lists of colors
better-evaluation-view-opt-colorLists-desc = Show lists of colors as lists of rgb values
