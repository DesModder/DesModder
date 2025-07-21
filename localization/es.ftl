# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Hardcoded in the Typescript:
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
GLesmos-desc = Genera funciones implícitas en la GPU. Puede ralentizar la interfaz gráfica o en raras ocasiones puede congelar la página. Recarga la página si te causa problemas.
GLesmos-label-toggle-glesmos = Usar GLesmos
GLesmos-confirm-lines = Confirmar líneas
GLesmos-confirm-lines-body = Generar líneas con GLesmos puede ser lento. Sé especialmente cuidadoso cuando utilices listas.
GLesmos-no-support = Desafortunadamente tu navegador no soporta GLesmos porque no provee soporte para WebGL2.
GLesmos-not-enabled = Habilita GLesmos para mejorar el rendimiento de algunas expresiones implícitas.
# Missing: error messages

## Tips
show-tips-name = Mostrar Consejos
show-tips-desc = Te muestra consejos en la parte de abajo de la lista de expresiones
show-tips-tip-export-videos = Cuando exportas videos es preferible escoger MP4 o APNG sobre GIF
show-tips-tip-disable-graphpaper = Cuando necesites escribir ecuaciones largas, es útil deshabilitar el área del gráfico en la Configuración de Calculadora
show-tips-tip-paste-asciimath = Puedes pegar ecuaciones en formato ASCII directamente en Desmos
show-tips-tip-pin = Fija expresiones que uses frecuentemente para no perderlas de vista
show-tips-tip-long-video-capture = Antes de empezar a capturar un vídeo largo, es una buena idea exportar un vídeo corto de prueba
show-tips-tip-find-replace = Buscar y reemplazar es ideal para renombrar variables
show-tips-tip-duplicate = Presiona Ctrl+Q ó Ctrl+Shift+Q para duplicar la expresión seleccionada
show-tips-tip-note-newline = Teclea Shift+Entrar para añadir líneas nuevas en las notas y en los títulos de imágenes/carpetas
show-tips-tip-hide-errors = Has clic a los triángulos de advertencia para desvanecerlos (o presiona Shift+Entrar)
show-tips-tip-note-folder = Para crear una nota puedes teclear una comilla doble o escribir "folder" para crear una carpeta
show-tips-tip-arctan = Utiliza arctan(y, x) en lugar de arctan(y / x) para obtener el ángulo de un punto
show-tips-tip-indefinite-integral = Puedes utilizar límites infinitos en integrales
show-tips-tip-random = La función "random" puede tomar muestras de una distribución
show-tips-tip-two-argument-round = La función "round" con su segundo argumento es ideal para redondear números para rótulos
show-tips-tip-two-argument-sort = Es posible reordenar una lista con la clasificación de otra usando "sort(A, B)"
show-tips-tip-custom-colors = Crea colores personalizados usando las funciones "rgb" y "hsv"
show-tips-tip-ctrl-f = Presiona Ctrl+F para buscar expresiones
show-tips-tip-derivatives = Toma derivadas usando notación de Lagrange o notación de Leibniz
show-tips-tip-unbounded-list-slices = Los límites de listas no tienen que estar acotados
show-tips-tip-dataviz-plots = Para visualizar datos puedes utilizar las funciones "histogram", "boxplot", y más
show-tips-tip-statistics = Desmos tiene muchísimas funciones para estadística
show-tips-tip-table-draggable-points = Una tabla te permite crear una lista de puntos interactivos
show-tips-tip-polygon = Utiliza la función "polygon" para crear polígonos con facilidad
show-tips-tip-point-arithmetic = Puedes aplicar aritmética a puntos (o vectores). Por ejemplo, (1, 2) + (3, 4) es (4, 6)
show-tips-tip-shift-drag = Shift+click izquierdo sobre un eje te permite cambiar el tamaño de ese eje independientemente
show-tips-tip-action-ticker = Utiliza acciones y contadores para correr simulaciones
show-tips-tip-latex-copy-paste = Expresiones copiadas en Desmos pueden ser pegadas en editores de composición de texto así como LaTeX
show-tips-tip-time-in-worker = Para monitorear el rendimiento del gráfico añade "?timeInWorker" a la URL o activa el Monitor de Rendimiento
show-tips-tip-format-labels = Enmarca el texto de rótulos entre ` para darles formato de expresión
show-tips-tip-dynamic-labels = Puedes enmarcar nombres de variables en ${"{"} {"}"} para mostrar su valor en rótulos
show-tips-tip-disable-text-outline = Deshabilitar el borde de texto puede hacer rótulos más legibles en algunos casos
show-tips-tip-regression-power = La utilidad de regresiones en Desmos te puede sorprender
show-tips-tip-spreadsheet-table = Pega datos de una hoja de cálculo (como Excel) para crear una tabla
show-tips-tip-keyboard-shortcuts = Presiona Ctrl+/ ó Cmd+/ para mostrar la lista de atajos de teclado
show-tips-tip-listcomps = Las listas por comprensión son ideales para crear cuadrículas de puntos o listas de polígonos
show-tips-tip-list-filters = Puedes utilizar filtrado de listas para filtrar elementos positivos, pares y más
# Unchanged
show-tips-tip-bernard = Bernard
show-tips-tip-new-desmos = ¡Lo nuevo en Desmos!
show-tips-tip-simultaneous-actions = Las reglas de una acción son simultáneas no secuenciales
show-tips-tip-share-permalink = Puedes compartir gráficos por medio de un permalink sin necesidad de iniciar sesión
show-tips-tip-point-coordinate = Puedes acceder las coordenadas de x ó y de un punto añadiendo .x ó .y a la variable de tu punto
show-tips-tip-audiotrace = ¡Escucha tus gráficos utilizando el modo Seguimiento de Audio!
show-tips-tip-audiotrace-note-frequency = Las frecuencias de sonido del seguimiento de audio son relativas a la posición del gráfico en la pantalla.
show-tips-tip-audiotrace-range = El rango del seguimiento de audio empieza en Mi 4ª (329.63 hz) y termina en Mi 5ª (659.25 Hz)
show-tips-tip-other-calculators = ¡Desmos también ofrece otros tipos de calculadores!
show-tips-tip-lock-viewport = ¿No quieres que el área del gráfico se mueva? ¡Fíjala en la configuración del gráfico!
show-tips-tip-glesmos = Habilita la extensión GLesmos para que tus expresiones implícitas sean más rápidas
show-tips-tip-disable-show-tips = ¿Cansado de verme? Deshabilita "Mostrar Consejos" en la configuración de Desmodder
show-tips-tip-compact-view-multiline = ¿Harto de navegar largas listas de expresiones? Prueba la Vista Compacta y/o Expresiones Multilínea para ver más contenido
show-tips-tip-intellisense = ¿Los nombres de tus variables son muy largos? Habilita Intellisense para lidiar con estos más fácilmente
show-tips-tip-youre-doing-great = ¡Vamos! Tu puedes :)
show-tips-tip-youre-superb = Eres increíble <3
show-tips-tip-huggy = ¡Un abrazo de oso!

## Text Mode
text-mode-name = Modo Texto BETA
text-mode-desc = Errores son esperados. Documentación temporal:
text-mode-toggle = Alternar Modo Texto
text-mode-toggle-spaces = Espacios
text-mode-toggle-spaces-tooltip = Incluir espacios superfluos al aplicar formato
text-mode-toggle-newlines = Nueva línea
text-mode-toggle-newlines-tooltip = Incluir nueva línea y sangrado al aplicar formato
text-mode-format = Dar Formato

## Find and Replace
find-and-replace-name = Buscar y Reemplazar
find-and-replace-desc = Agrega un botón de "reemplazar todo" en el menú de búsqueda con Ctrl+F y te permite cambiar fácilmente los nombres de variables o funciones.
find-and-replace-replace-all = reemplazar todo

## Wolfram To Desmos
wolfram2desmos-name = Wolfram a Desmos
wolfram2desmos-desc = Te permite pegar texto de ecuaciones en formato ASCII (así como las búsquedas en Wolfram Alpha) en Desmos.
wolfram2desmos-opt-reciprocalExponents2Surds-name = Notación Radical
wolfram2desmos-opt-reciprocalExponents2Surds-desc = Convierte exponentes fraccionarios menores que uno a su equivalente en radical.
wolfram2desmos-opt-derivativeLoopLimit-name = Expandir Derivadas
wolfram2desmos-opt-derivativeLoopLimit-desc = Expande las derivadas de orden superior en notación de Leibniz en forma de derivadas anidadas (límite de 10).

## Pin Expressions
pin-expressions-name = Fijar Expresiones
pin-expressions-desc = Fija expresiones desde modo de edición
pin-expressions-pin = Fijar
pin-expressions-unpin = Desfijar

## Builtin Settings
builtin-settings-name = Configuración de Calculadora
builtin-settings-desc = Te permite configurar las funciones integradas en Desmos. La mayoría de las opciones aplican solamente a tu navegador y son ignoradas cuando compartes tu gráfico con otras personas.
builtin-settings-opt-advancedStyling-name = Diseño avanzado
builtin-settings-opt-advancedStyling-desc = Permite editar rótulos, así como mostrar éstos cuando el cursor está encima, añadir contorno de texto y mostrar un solo cuadrante de cuadrícula.
builtin-settings-opt-graphpaper-name = Área del Gráfico
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
builtin-settings-opt-keypad-name = Mostrar el teclado numérico
# Unchanged
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-showPerformanceMeter-name = Mostrar Monitor de Rendimiento
# Unchanged
builtin-settings-opt-showPerformanceMeter-desc = {""}
builtin-settings-opt-showIDs-name = Mostrar IDs
# Unchanged
builtin-settings-opt-showIDs-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Tecla Rápida para Duplicar Expresión
duplicate-expression-hotkey-desc = Presiona Ctrl+Q ó Ctrl+Shift+Q para replicar la expresión seleccionada.

## Right Click Tray
right-click-tray-name = Color con Clic Derecho
right-click-tray-desc = Permite abrir el menú para configurar expresiones con el clic derecho.

## Set Primary Color
set-primary-color-name = Cambiar Color de Aplicación
set-primary-color-desc = Elige el color principal para la interfaz de usuario.
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
video-creator-desc = Te permite exportar videos y GIFs de tu gráfico usando acciones o controles deslizantes.
video-creator-menu = Menú del Creador de Video
video-creator-to = hasta
video-creator-step = , paso
video-creator-ticks-playing-sliders = Deslizadores activos:
video-creator-ticks-step = Tiempo por paso (ms):
video-creator-prev-action = Previo
video-creator-next-action = Siguiente
video-creator-orientation = Orientación
video-creator-orientation-mode-current-speed = actual
video-creator-orientation-mode-current-delta = recorrer
video-creator-orientation-mode-from-to = rango
video-creator-size = Tamaño:
video-creator-mosaic = Mosaico:
video-creator-angle-current = Ángulo:
video-creator-angle-from = Desde:
video-creator-angle-to = Hasta:
video-creator-angle-step = Paso:
video-creator-angle-speed = Velocidad:
video-creator-step-count = Número de pasos:
video-creator-frame-count = Número de cuadros:
video-creator-target-same-pixel-ratio = Mantener la misma proporción de píxeles.
video-creator-fast-screenshot = Captura rápida
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
video-creator-method-ntimes = contar
video-creator-method-slider = deslizador
video-creator-method-action = acción
video-creator-method-ticks = contador

## Wakatime
# Unchanged
wakatime-name = WakaTime
wakatime-desc = Le da seguimiento a tu actividad de Desmos en WakaTime.com
wakatime-opt-secretKey-name = Llave Secreta
wakatime-opt-secretKey-desc = Llave API usada para los servidores de WakaTime
wakatime-opt-splitProjects-name = Separa los proyectos por gráficos individuales
wakatime-opt-splitProjects-desc = Guarda cada gráfico como su propio proyecto y no como ramificaciones de un solo proyecto de Desmos.
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
better-evaluation-view-opt-floats-name = Punto flotante avanzado
better-evaluation-view-opt-floats-desc = Mostrar NaN/∞/-∞ en lugar de 'undefined' y '-0' cuando 0 es negativo.
better-evaluation-view-opt-lists-name = Mostrar los elementos de la lista.
better-evaluation-view-opt-lists-desc = Mostrar los elementos de la lista en vez de su tamaño.
better-evaluation-view-opt-colors-name = Mostrar colores
better-evaluation-view-opt-colors-desc = Mostrar colores como valores RGB
better-evaluation-view-opt-colorLists-name = Mostrar listas de colores
better-evaluation-view-opt-colorLists-desc = Mostrar listas de colores como listas de valores RGB

## Pillbox Menus
pillbox-menus-name = Menú de Botones (Funciones Principales)
pillbox-menus-desc = Muestra botones al lado derecho, así como el Creador de Video o el menú principal de DesModder

## Manage Metadata
manage-metadata-name = Administrar Metadatos (Funciones Principales)
manage-metadata-desc = Permite administrar metadatos, así como las extensiones GLesmos o Fijar Expresiones

## Intellisense
# Unchanged
intellisense-name = Intellisense
intellisense-desc = Brinda varias funciones esenciales de una IDE en Desmos incluyendo sugerencias de autocompletado, visualización de parámetros, e ir a definición. Sigue el enlace para la documentación:
intellisense-opt-subscriptify-name = Convertir Subíndices
intellisense-opt-subscriptify-desc = Automáticamente convierte nombres de funciones o variables con subíndices, aunque los escribas sin estos.
intellisense-jump2def-menu-instructions = tiene múltiples definiciones. Elige a cuál quieres navegar.

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
compact-view-opt-hideFolderToggles-name = Ocultar Opciones de Carpeta
compact-view-opt-hideFolderToggles-desc = Esconde las opciones de carpeta para ocultar carpeta y poner delante de todo.
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
multiline-opt-automaticallyMultilinify-name = Ajuste de línea al teclear
multiline-opt-automaticallyMultilinify-desc = Automáticamente divide las expresiones en múltiples líneas mientras escribes sin la necesidad the teclear Ctrl+M.
multiline-opt-multilinifyDelayAfterEdit-name = Retraso de ajuste (ms)
multiline-opt-multilinifyDelayAfterEdit-desc = Retrasa el ajuste de líneas en la expresión que estás editando por el número de milisegundos especificado.
multiline-opt-spacesToNewlines-name = Espacios a Líneas Nuevas
multiline-opt-spacesToNewlines-desc = Convierte grupos de 3 espacios a líneas nuevas. Puedes usar Shift+Entrar para el mismo efecto.
multiline-opt-determineLineBreaksAutomatically-name = Ajuste de línea automático
multiline-opt-determineLineBreaksAutomatically-desc = Determina automáticamente en dónde utilizar ajuste de línea. Alternatívamente puedes utilizar Ctrl+M para insertar líneas nuevas.
multiline-opt-disableAutomaticLineBreaksForHandAlignedExpressions-name = Ignorar expresiones con tres espacios
multiline-opt-disableAutomaticLineBreaksForHandAlignedExpressions-desc = Previene el ajuste de línea en expresiones donde líneas nuevas han sido insertadas manualmente.

## Custom MathQuill Config
custom-mathquill-config-name = Configuración de MathQuill
custom-mathquill-config-desc = Te permite expandir y personalizar la edición de ecuaciones
custom-mathquill-config-opt-superscriptOperators-name = Operadores en exponentes
custom-mathquill-config-opt-superscriptOperators-desc = Permite teclear operadores, así como "+", en los exponentes
custom-mathquill-config-opt-noAutoSubscript-name = Deshabilita subíndices automáticos
custom-mathquill-config-opt-noAutoSubscript-desc = Deshabilita subíndices automáticos en números cuando estos son escritos después de una variable
custom-mathquill-config-opt-noNEquals-name = Deshabilita n= en sumatorio
custom-mathquill-config-opt-noNEquals-desc = Deshabilita "n=" en el límite inferior de los sumatorios
custom-mathquill-config-opt-subSupWithoutOp-name = Subíndices y exponentes sin base
custom-mathquill-config-opt-subSupWithoutOp-desc = Permite crear subíndices y exponentes sin que estos estén precedidos de un símbolo
custom-mathquill-config-opt-allowMixedBrackets-name = Permitir paréntesis mezclados
custom-mathquill-config-opt-allowMixedBrackets-desc = Permite mezclar paréntesis de distinto tipo (incluyendo el valor absoluto)
custom-mathquill-config-opt-subscriptReplacements-name = Permite reemplazos en subíndices
custom-mathquill-config-opt-subscriptReplacements-desc = Permite símbolos y nombres de funciones dentro de los subíndices
custom-mathquill-config-opt-noPercentOf-name = Deshabilita % of
custom-mathquill-config-opt-noPercentOf-desc = Permite teclear el carácter "%" sin la inserción automática de "% of"
custom-mathquill-config-opt-commaDelimiter-name = Coma de separación
custom-mathquill-config-opt-commaDelimiter-desc = Inserta comas de separación en números (sólo visualmente)
custom-mathquill-config-opt-delimiterOverride-name = Separador personalizado
custom-mathquill-config-opt-delimiterOverride-desc = Carácter que va a ser usado como separador de millares
custom-mathquill-config-opt-leftIntoSubscript-name = Navegación hacia subíndices
custom-mathquill-config-opt-leftIntoSubscript-desc = Prioriza subíndices sobre exponentes al navegar con las flechas del teclado
custom-mathquill-config-opt-extendedGreek-name = Más letras griegas
custom-mathquill-config-opt-extendedGreek-desc = Habilita reemplazos para todas las letras griegas
custom-mathquill-config-opt-lessFSpacing-name = Reducir interletraje en la "f"
custom-mathquill-config-opt-lessFSpacing-desc = Reduce el espacio a los lados de la letra "f" en expresiones

## Code Golf
# Unchanged
code-golf-name = Code Golf
code-golf-desc = Herramientas para ayudar con el code golf en Desmos.
code-golf-width-in-pixels = Ancho: { $pixels } px
code-golf-symbol-count = Cantidad de Símbolos: { $elements }
code-golf-click-to-enable-folder = Has clic para habilitar estadísticas de tu golf.
# Unchanged
code-golf-note-latex-byte-count = { $chars } LaTeX Bytes

## Syntax highlightAlternatingLines
syntax-highlighting-name = Resaltado de Sintaxis
syntax-highlighting-desc = Colorea distintas partes de una expresión para hacerlas más fácil de distinguir.
syntax-highlighting-opt-bracketPairColorization-name = Colorear Pares de Paréntesis
syntax-highlighting-opt-bracketPairColorization-desc = Aplica diferentes colores a cada par balanceado de paréntesis para hacerlos más fácil de emparejar visualmente.
syntax-highlighting-opt-bracketPairColorizationColors-name = Colores de Pares
syntax-highlighting-opt-bracketPairColorizationColors-desc = Especifica el número y el orden de los colores utilizados para colorear los paréntesis.
syntax-highlighting-opt-bpcColorInText-name = Colorear Texto Encerrado
syntax-highlighting-opt-bpcColorInText-desc = Aplica el mismo color de cada paréntesis al texto que estos encierran.
syntax-highlighting-opt-thickenBrackets-name = Ensanchar Paréntesis
syntax-highlighting-opt-thickenBrackets-desc = Adherir ancho adicional a los paréntesis para asistir el coloreado de éstos.
syntax-highlighting-opt-highlightBracketBlocks-name = Resaltar Bloques
syntax-highlighting-opt-highlightBracketBlocks-desc = Resalta el grupo de paréntesis más pequeño que contiene el cursor de texto.
syntax-highlighting-opt-highlightBracketBlocksHover-name = Resaltar con el Ratón
syntax-highlighting-opt-highlightBracketBlocksHover-desc = Resalta el grupo de paréntesis más pequeño que contiene el cursor del ratón.
syntax-highlighting-opt-underlineHighlightedRanges-name = Subrayar Grupos Resaltados
syntax-highlighting-opt-underlineHighlightedRanges-desc = Agrega subrayado debajo de los grupos resaltados para mejorar visibilidad.

## Better Navigation
better-navigation-name = Navegación Mejorada
better-navigation-desc = Te provee herramientas para facilitar la navegación en Desmos.
better-navigation-opt-ctrlArrow-name = Atajo Ctrl+Flecha.
better-navigation-opt-ctrlArrow-desc = Te permite utilizar Ctrl+Flecha y Ctrl+Shift+Flecha para avanzar bloques de texto más rápidamente. De manera similar puedes usar Ctrl+Retroceso para borrar bloques.
better-navigation-opt-scrollableExpressions-name = Expresiones Desplazables
better-navigation-opt-scrollableExpressions-desc = Añade una barra de desplazamiento horizontal. Mayormente destinado para facilitar la navegación en móvil.
better-navigation-opt-showScrollbar-name = Mostrar Barra de Desplazamiento
better-navigation-opt-showScrollbar-desc = Mostrar o esconder barra de desplazamiento. Coveniente para dispositivos de pantalla táctil.

## Paste Image
paste-image-name = Pegar Imagen
paste-image-desc = Te permite pegar imagenes directamente en las expressiones para importar.
paste-image-error-images-not-enabled = Inserción de imagen no está disponible para este gráfico.
paste-image-error-another-upload-in-progress = Vuelve a intentar cuando la imagen previa termine de procesarse.

## Quake Pro
# Unchanged
quake-pro-name = Quake Pro
quake-pro-desc = Permite incrementar el campo de visión más allá del límite regular.
quake-pro-opt-magnification-name = Multiplicador de Zoom
quake-pro-opt-magnification-desc = Factor por el cual se incrementa el límite de zoom.
