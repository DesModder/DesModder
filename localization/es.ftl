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
show-tips-desc = Muestra consejos hasta abajo de la lista de expresiones.
# Missing: all tips. Is it worthwhile?

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
builtin-settings-opt-trace-desc = Permite hacer click en curvas para obtener coordenadas.
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
right-click-tray-name = Color con Click Derecho
right-click-tray-desc = Permite abrir el menú para configurar expresiones con el click derecho.

## Set Primary Color
set-primary-color-name = Cambiar Color de Aplicación
set-primary-color-desc = Elije el color principal para la interfaz de usuario.
set-primary-color-opt-primaryColor-name = Color principal
set-primary-color-opt-primaryColor-desc = Cambia el color principal en toda la calculadora.
set-primary-color-opt-doFavicon-name = Actualizar el icono del sitio web.
set-primary-color-opt-doFavicon-desc = Alternar el color del icono del sitio web.

## Hide Errors
hide-errors-name = Esconder los Errores
hide-errors-desc = Permite hacer click a los triángulos de error para desvanecerlos y esconde las sugerencias de controles deslizantes.
hide-errors-hide = Esconder

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
shift-enter-newline-desc = Teclea Shift+Entrar para añadir líneas nuevas en las notas y en los títulos de imágenes/carpetas.

## Wakatime
# Unchanged
wakatime-name = WakaTime
wakatime-desc = Dale seguimiento a tu actividad de Desmos en WakaTime.com
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
