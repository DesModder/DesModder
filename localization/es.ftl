# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Harcdoded in the Typescript:
# [pluginID]-name = Name
# [pluginID]-desc = Description
# [pluginID]-opt-[optionKey]-name = Option Name
# [pluginID]-opt-[optionKey]-desc = Option Description

## General
menu-learn-more = Aprende más
menu-desmodder-plugins = Extensiones de DesModder
menu-desmodder-tooltip = Menú de DesModder

## Category names
category-core-name = Funciones Principales
category-utility-name = Utilidades
category-visual-name = Apariencia
category-integrations-name = Integraciones

## GLesmos
# Unchanged
GLesmos-name = GLesmos
GLesmos-desc = Genera funciones implícitas en la GPU. Se deshabilita cuando la página es refrescada. Puede ralentizar la interfaz gráfica o en raras ocasiones puede congelar la página. Recarga la página si te causa problemas.
GLesmos-label-toggle-glesmos = Usar GLesmos
GLesmos-confirm-lines = Confirmar líneas
GLesmos-confirm-lines-body = Generar líneas con GLesmos puede ser lento. Sé especialmente cuidadoso cuando utilices listas.
# Missing: error messages

## Tips
show-tips-name = Mostrar consejos
show-tips-desc = Te muestra consejos en la parte de abajo de la lista de expresiones
show-tips-tip-export-videos = Cuando exportas videos es preferible escojer MP4 o APNG sobre GIF
show-tips-tip-disable-graphpaper = Cuando necesitas escribir ecuaciones largas, es útil deshabilitar el área del gráfico en la Configuración de Calculadora
show-tips-tip-paste-asciimath = Puedes pegar ecuaciones en formato ASCII directamente en Desmos
show-tips-tip-pin = Fija expresiones que uses bastante para no perderlas de vista
show-tips-tip-long-video-capture = Antes de empezar a capturar un vídeo largo, es una buena idea exportar un vídeo corto de prueba
show-tips-tip-find-replace = Buscar y reemplazar es ideal para renombrar variables
show-tips-tip-duplicate = Pressiona Ctrl+Q ó Ctrl+Shift+Q para duplicar la expression seleccionada
show-tips-tip-note-newline = Teclea Shift+Entrar para añadir líneas nuevas en las notas y en los títulos de imágenes/carpetas
show-tips-tip-hide-errors = Haz clic a los triángulos de advertencia para desvanecerlos (o teclea Shift+Entrar)
show-tips-tip-note-folder = Para crear una nota puedes teclear " o escribir "folder" para crear una carpeta
show-tips-tip-arctan = Utiliza arctan(y, x) en lugar de arctan(y/x) para obtener el angulo de un punto
show-tips-tip-indefinite-integral = Puedes utilizar límites infinitos en integrales
show-tips-tip-random = La función "random" puede tomar muestras de una distribución
show-tips-tip-two-argument-round = La función "round" con su segundo argumento es ideal para redondear números para rótulos
show-tips-tip-two-argument-sort = Es posible reordernar una lista con la clasificación de otra usando "sort(A, B)"
show-tips-tip-custom-colors = Crea colores personalizados usando las funciones "rgb" y "hsv"
show-tips-tip-ctrl-f = Teclea Ctrl+F para buscar expresiones
show-tips-tip-derivatives = Toma derivadas usando notación de Lagrange. Por ejemplo f`(x)
show-tips-tip-unbounded-list-slices = Los limites the listas no tienen que estar acotados. Por ejemplo L[1...]
show-tips-tip-dataviz-plots = Para visualizar datos puedes utilizar las funciones "histogram", "boxplot", y más
show-tips-tip-statistics = Desmos tiene muchisimas funciones para estadística
show-tips-tip-table-draggable-points = Una tabla te permite crear una lista de puntos interactivos
show-tips-tip-polygon = Utiliza la función "polygon" para crear poligones con facilidad
show-tips-tip-point-arithmetic = Point (vector) arithmetic works as expected (e.g. (1, 2) + (3, 4) is (4, 6))
show-tips-tip-shift-drag = Shift-mouse drag over an axis to scale only that axis
show-tips-tip-action-ticker = Use actions and tickers to run simulations
show-tips-tip-latex-copy-paste = The math from Desmos can be directly copy-pasted into LaTeX editors
show-tips-tip-time-in-worker = To test how fast your graph runs, use ?timeInWorker or enable the Performance Display plugin
show-tips-tip-format-labels = Use backticks to math-format point labels
show-tips-tip-dynamic-labels = Use ${"{"} {"}"} for dynamic point labels based on a variable
show-tips-tip-disable-text-outline = Disabling text outline can sometimes make labels more readable
show-tips-tip-regression-power = Regressions are more powerful than you can imagine
show-tips-tip-spreadsheet-table = Paste spreadsheet data to make a table
show-tips-tip-keyboard-shortcuts = Type Ctrl+/ or Cmd+/ to open the list of keyboard shortcuts
show-tips-tip-listcomps = List comprehensions are great for grids of points or lists of polygons
show-tips-tip-list-filters = List filters can be used to filter for positive elements, even elements, and more
show-tips-tip-bernard = Bernard
show-tips-tip-new-desmos = What's new at Desmos
show-tips-tip-simultaneous-actions = Action assignments are simultaneous, not sequential
show-tips-tip-share-permalink = You can share graphs via permalink without signing in
show-tips-tip-point-coordinate = Extract the x or y coordinate of points by appending .x or .y to your point variable
show-tips-tip-audiotrace = Listen to your graphs using Audio Trace!
show-tips-tip-audiotrace-note-frequency = Note frequencies for audio trace depend on how high or low they are located in the viewport
show-tips-tip-audiotrace-range = Audio Trace range starts on an E4 (329.63Hz) and ends on E5 (659.25Hz)
show-tips-tip-other-calculators = Desmos also has other calculators!
show-tips-tip-lock-viewport = Don't want your viewport to be moved? Lock it in the graph settings!
show-tips-tip-glesmos = Enable the GLesmos plugin to make some implicits run faster
show-tips-tip-disable-show-tips = Tired of seeing me? Disable the "Show Tips" plugin in the Desmodder settings
show-tips-tip-compact-view-multiline = Sick of scrolling the expressions panel? Try enabling Compact View and/or Multiline Expressions to see more at once
show-tips-tip-intellisense = Too many long variable names? Enable Intellisense to make dealing with them easier
show-tips-tip-youre-doing-great = You're doing great :)
show-tips-tip-youre-superb = You're superb <3
show-tips-tip-huggy = Huggy!

## Text Mode
text-mode-name = Modo Texto BETA
text-mode-desc = Errores son esperados. Documentación temporal:
text-mode-toggle = Alternar Modo Texto
# Missing: error messages

## Debug Mode
debug-mode-name = Modo de Depuración
debug-mode-desc = Muestra los IDs de las expresiones en lugar de los índices.

## Find and Replace
find-and-replace-name = Buscar y Reemplazar
find-and-replace-desc = Agrega un botón de "reemplazar todo" en el menú de búsqueda con Ctrl+F y te permite cambiar fácilmente los nombres de variables o funciones.
find-and-replace-replace-all = reemplazar todo

## Wolfram To Desmos
wolfram2desmos-name = Wolfram a Desmos
wolfram2desmos-desc = Te permite pegar texto de ecuaciones en formato ASCII (así como las búsquedas en Wolfram Alpha) en Desmos.
wolfram2desmos-opt-reciprocalExponents2Surds-name = Notación Radical
wolfram2desmos-opt-reciprocalExponents2Surds-desc = Convierte exponentes fraccionales menor que uno a su equivalente en radical.
wolfram2desmos-opt-derivativeLoopLimit-name = Expandir derivadas
wolfram2desmos-opt-derivativeLoopLimit-desc = Expande las derivadas de orden superior en notación de Leibniz en forma de derivadas anidadas (límite de 10).

## Pin Expressions
pin-expressions-name = Fijar Expresiones
pin-expressions-desc = Fija expresiones desde modo de edición
pin-expressions-pin = Fijar
pin-expressions-unpin = Desfijar

## Builtin Settings
builtin-settings-name = Configuración de Calculadora
builtin-settings-desc = Te permite configurar las funciones integradas en Desmos. La mayoría de las opciones aplican solamente a tu navegador y son ignoradas cuando compartes tu gráfica con otras personas.
builtin-settings-opt-advancedStyling-name = Diseño avanzado
builtin-settings-opt-advancedStyling-desc = Permite editar rótulos, mostrar el rótulo al pasar el mouse, añadir contorno de texto y mostrar un solo cuadrante de cuadrícula.
builtin-settings-opt-graphpaper-name = Área de Gráfica
# Unchanged
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = Funciones para autores 
builtin-settings-opt-authorFeatures-desc = Permite esconder carpetas, expresiones de solo lectura, y más.
builtin-settings-opt-pointsOfInterest-name = Muestra puntos de interés.
builtin-settings-opt-pointsOfInterest-desc = Cortes de eje x/y, discontinuidades, intersecciones, etc.
builtin-settings-opt-trace-name = Trazar sobre curvas
builtin-settings-opt-trace-desc = Permite hacer clic en curvas para obtener coordenadas.
builtin-settings-opt-expressions-name = Mostrar Expresiones
# Unchanged
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = Muestra los Botones de Zoom
# Unchanged
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Muestra la Barra Superior de Expresiones
# Unchanged
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = Borde
builtin-settings-opt-border-desc = Muestra un borde alrededor del calculador.
builtin-settings-opt-keypad-name = Mostrar el teclado numérico
# Unchanged
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = Teclado QWERTY
# Unchanged
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Atajo de teclado para Duplicar Expresión
duplicate-expression-hotkey-desc = Teclea Ctrl+Q ó Ctrl+Shift+Q para replicar la expresión seleccionada.

## Right Click Tray
right-click-tray-name = Color con clic Derecho
right-click-tray-desc = Permite abrir el menú para configurar expresiones con el clic derecho.

## Set Primary Color
set-primary-color-name = Cambiar Color de Aplicación
set-primary-color-desc = Elije el color principal para la interfaz de usuario.
set-primary-color-opt-primaryColor-name = Color principal
set-primary-color-opt-primaryColor-desc = Cambia el color principal en toda la calculadora.
set-primary-color-opt-doFavicon-name = Actualizar el icono del sitio web.
set-primary-color-opt-doFavicon-desc = Alternar el color del icono del sitio web.

## Hide Errors
hide-errors-name = Esconder los Errores
hide-errors-desc = Permite hacer clic en los triángulos de advertencia para desvanecerlos y esconder las sugerencias de controles deslizantes.
hide-errors-hide = esconder

## Folder Tools
folder-tools-name = Herramientas para Carpetas
folder-tools-desc = Añade botones en el modo de edición para ayudar con la gestión de carpetas
folder-tools-dump = Vaciar
folder-tools-merge = Llenar
folder-tools-enclose = Encerrar

## Video Creator
video-creator-name = Creador de Video
video-creator-desc = Te permite exportar videos y GIFs de tu gráfica con acciones o controles deslizantes.
video-creator-menu = Menú del Creador de Video
video-creator-to = hasta
video-creator-step = , paso
video-creator-ticks-step = Tiempo por paso (ms):
video-creator-prev-action = Previo
video-creator-next-action = Siguiente
video-creator-size = Tamaño:
video-creator-step-count = Número de pasos:
video-creator-target-same-pixel-ratio = Mantener la misma proporción de píxeles.
video-creator-target-tooltip = Ajustar la magnitud del ancho de las líneas, el tamaño de puntos, el tamaño de rótulos, etc.
video-creator-ffmpeg-loading = cargando FFmpeg...
video-creator-ffmpeg-fail = Si no funciona en unos segundos, prueba recargar la página o informa los devs de DesModder sobre el error.
video-creator-exporting = Exportando...
video-creator-cancel-capture = Cancelar
video-creator-cancel-export = Cancelar
video-creator-capture = Capturar
video-creator-preview = Vista Rápida
video-creator-delete-all = Eliminar todo
video-creator-filename-placeholder = nombre de tu video...
video-creator-export = Exportar
video-creator-export-as = Exportar como { $fileType }
# Unchanged
video-creator-fps = FPS:
video-creator-method-once = una vez
video-creator-method-slider = deslizador
video-creator-method-action = acción
video-creator-method-ticks = contador

## Shift+Enter Newline
shift-enter-newline-name = Nueva línea con Shift+Entrar
shift-enter-newline-desc = Permite teclear Shift+Entrar para añadir líneas nuevas en las notas y en los títulos de imágenes/carpetas.

## Wakatime
# Unchanged
wakatime-name = WakaTime
wakatime-desc = Le da seguimiento a tu actividad de Desmos en WakaTime.com
wakatime-opt-secretKey-name = Llave Secreta
wakatime-opt-secretKey-desc = Llave API usada para los servidores de WakaTime
wakatime-opt-splitProjects-name = Separa los proyectos por gráficas individuales
wakatime-opt-splitProjects-desc = Guarda cada gráfica como su propio proyecto y no como ramificaciones de un solo proyecto de Desmos.
wakatime-opt-projectName-name = Nombre de Proyecto
wakatime-opt-projectName-desc = Visible en WakaTime y es compartido por todos tus proyectos de Desmos.

## Performance Display
performance-info-name = Monitor de Rendimiento
performance-info-desc = Visualiza información sobre el rendimiento del gráfico.
performance-info-refresh-graph = Refrescar el Gráfico
performance-info-refresh-graph-tooltip = Refresca el gráfico para monitorear el tiempo de carga.
performance-info-sticky-tooltip = Mantener el menú abierto 
performance-info-time-in-worker = Tiempo en Web Worker
performance-info-compiling = Compilando
performance-info-rendering = Visualizando
performance-info-other = Otro

## Better Evaluation View
better-evaluation-view-name = Mejor Vista de Evaluación
better-evaluation-view-desc = Permite dar un vistazo a los elementos en listas, colores, y los números indefinidos.
better-evaluation-view-opt-lists-name = Mostrar los elementos de la lista.
better-evaluation-view-opt-lists-desc = Mostrar los elementos de la lista en vez de su tamaño.
better-evaluation-view-opt-colors-name = Mostrar colores
better-evaluation-view-opt-colors-desc = Mostrar colores como valores RGB
better-evaluation-view-opt-colorLists-name = Mostrar listas de colores
better-evaluation-view-opt-colorLists-desc = Mostrar listas de colores como listas de valores RGB

## Pillbox Menus
pillbox-menus-name = Menú de botones (Funciones Principales)
pillbox-menus-desc = Muestra botones al lado derecho, así como el Creador de Video o el menú principal de DesModder

## Manage Metadata
manage-metadata-name = Administrar Metadatos (Funciones Principales)
manage-metadata-desc = Permite administrar metadatos, así como las extensiones GLesmos o Fijar Expresiones

## Intellisense
# Unchanged
intellisense-name = Intellisense
intellisense-desc = Brinda varias funciones esenciales de una IDE en Desmos incluyendo sugerencias de autocompletado, visualización de parámetros, e ir a definición. Sigue el enlace para la documentación:
intellisense-jump2def-menu-instructions = tiene múltiples definiciones. Elije a cuál quieres navegar.

## Compact View
compact-view-name = Vista Compacta
compact-view-desc = Permite personalizar la interfaz gráfica con énfasis en mostrar más información de manera compacta.
compact-view-opt-textFontSize-name = Tamaño de fuente (texto)
compact-view-opt-textFontSize-desc = Tamaño del texto en notas y carpetas
compact-view-opt-mathFontSize-name = Tamaño de fuente (matemática)
compact-view-opt-mathFontSize-desc = Tamaño de texto de expresiones y ecuaciones
compact-view-opt-bracketFontSizeFactor-name = Factor de paréntesis
compact-view-opt-bracketFontSizeFactor-desc = Este factor ajusta el tamaño del texto encerrado en paréntesis (o corchetes).
compact-view-opt-minimumFontSize-name = Mínimo tamaño de fuente
compact-view-opt-minimumFontSize-desc = El mínimo tamaño de fuente posible. Sobrescribe el factor de paréntesis.
compact-view-opt-compactFactor-name = Remover espacio
compact-view-opt-compactFactor-desc = Remueve el espacio entre las expresiones y notas en la lista.
compact-view-opt-noSeparatingLines-name = Sin líneas de separación
compact-view-opt-noSeparatingLines-desc = Remueve las líneas de separación entre el medio de las expresiones.
compact-view-opt-highlightAlternatingLines-name = Realzar líneas alternas
compact-view-opt-highlightAlternatingLines-desc = Realza con colores alternos las expresiones para que estas puedan distinguirse con más facilidad.
compact-view-opt-hideEvaluations-name = Colapsar evaluaciones
compact-view-opt-hideEvaluations-desc = Mueve evaluaciones de listas fuera de la vista y las muestra solo cuando colocas el cursor sobre ellas.

## Multiline
multiline-name = Expresiones Multilínea
multiline-desc = Divide expresiones largas en múltiples líneas. Puedes activar esta función manualmente presionando Ctrl+M.
multiline-opt-widthBeforeMultiline-name = Límite de ancho (%)
multiline-opt-widthBeforeMultiline-desc = Este es un porcentaje de la pantalla al cual el largo de la expresión provoca ajuste de líneas. En móvil este valor es triplicado.
multiline-opt-automaticallyMultilinify-name = Ajuste de línea automático
multiline-opt-automaticallyMultilinify-desc = Automáticamente divide las expresiones en múltiples líneas.
multiline-opt-multilinifyDelayAfterEdit-name = Retraso de ajuste (ms)
multiline-opt-multilinifyDelayAfterEdit-desc = Retrasa el ajuste de líneas en la expresión que estás editando por el número milisegundos especificado.

## Custom MathQuill Config
custom-mathquill-config-name = Configuración de MathQuill
custom-mathquill-config-desc = Te permite expandir y personalizar la edición de ecuaciones
custom-mathquill-config-opt-superscriptOperators-name = Operadores en exponentes
custom-mathquill-config-opt-superscriptOperators-desc = Permite teclear operadores, asi como '+', en los exponentes
custom-mathquill-config-opt-noAutoSubscript-name = Deshabilita subíndices automáticos
custom-mathquill-config-opt-noAutoSubscript-desc = Deshabilita subíndices automáticos en números cuando estos son escritos después de una variable
custom-mathquill-config-opt-noNEquals-name = Deshabilita n= en sumatorio
custom-mathquill-config-opt-noNEquals-desc = Deshabilita 'n=' en el límite inferior de los sumatorios
custom-mathquill-config-opt-subSupWithoutOp-name = Subíndices y exponentes sin base
custom-mathquill-config-opt-subSupWithoutOp-desc = Permite crear subíndices y exponentes sin que estos estén precedidos de un símbolo
custom-mathquill-config-opt-allowMixedBrackets-name = Permitir paréntesis mezclados
custom-mathquill-config-opt-allowMixedBrackets-desc = Permite mezclar paréntesis de distinto tipo (incluyendo el valor absoluto)
custom-mathquill-config-opt-subscriptReplacements-name = Permite reemplazos en subíndices
custom-mathquill-config-opt-subscriptReplacements-desc = Permite símbolos y nombres de funciones dentro de los subíndices
custom-mathquill-config-opt-noPercentOf-name = Deshabilita % of
custom-mathquill-config-opt-noPercentOf-desc = Permite teclear el carácter '%' sin la inserción automática de '% of'
custom-mathquill-config-opt-commaDelimiter-name = Coma de separación
custom-mathquill-config-opt-commaDelimiter-desc = Inserta comas de separación en números (sólo visualmente)
custom-mathquill-config-opt-delimiterOverride-name = Separador personalizado
custom-mathquill-config-opt-delimiterOverride-desc = Carácter que va a ser usado como separador de millares
custom-mathquill-config-opt-leftIntoSubscript-name = Navegación hacia subíndices
custom-mathquill-config-opt-leftIntoSubscript-desc = Prioriza subíndices sobre exponentes al navegar con las flechas del teclado
custom-mathquill-config-opt-extendedGreek-name = Más letras griegas
custom-mathquill-config-opt-extendedGreek-desc = Habilita reemplazos para todas las letras griegas
