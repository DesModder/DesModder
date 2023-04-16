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
GLesmos-name = GLesmos
GLesmos-desc = Genera funciones implícitas en la GPU. Se deshabilita cuando la página es refrescada. Puede ralentizar la interfaz gráfica o en raras ocasiones puede congelar la página. Recarga la página si te causa problemas.
GLesmos-label-toggle-glesmos = Generar gráfica con GLesmos
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
builtin-settings-desc = Te permite alternar las funciones integradas en Desmos. Lo mayoridad de los opciones solo aplica a el navegador tuyo, y son ignoradas cuando compartes tu gráfica con otras personas.
builtin-settings-opt-advancedStyling-name = Diseño avanzado
builtin-settings-opt-advancedStyling-desc = Permite la edición de etiquetas, mostra-en-pasar, contorno de texto, y cuadrícula con un quadrante
builtin-settings-opt-graphpaper-name = Papel de Gráfica
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = Carecterísticas Autores 
builtin-settings-opt-authorFeatures-desc = Permite carpetas escondidas, permite sóloleer, y más
builtin-settings-opt-pointsOfInterest-name = Muestra puntos de interés
builtin-settings-opt-pointsOfInterest-desc = Cortas, heucos, intersecciones, etc.
builtin-settings-opt-trace-name = Traza sobre cuervas
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = Muestra Expresiones
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = Muestra los Botones del Zoom
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Muestra la Barra Superior de Expresiones
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = Ribete
builtin-settings-opt-border-desc = Ribete minor alrededor del calculador 
builtin-settings-opt-keypad-name = Muestra el teclado numérico
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = QWERTY Teclado
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Atajo de teclado para Replicar Expresión
duplicate-expression-hotkey-desc = Teclea Ctrl+Q o Ctrl+Shift+Q para replicar el expresión selecciónado.

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
hide-errors-name = Esconde los Errores
hide-errors-desc = Haz click a los triángulos de errores para desvanecerlos y esconde los controles deslizantes sugeridos
hide-errors-hide = Esconde

## Folder Tools
folder-tools-name = Herramientas para Carpetas
folder-tools-desc = Añade botónes en edita-lista-modo para ayudar con la manipulación de carpetas
folder-tools-dump = Bota
folder-tools-merge = Une
folder-tools-enclose = Encerrar

## Video Creator
video-creator-name = Creador de Videos
video-creator-desc = Usas para exportar videos y GIFs de tu gráfica con los acciones y los controles deslizantes
Lets you export videos and GIFs of your graphs based on actions or sliders.
video-creator-menu = Menu para la Creador de Video
video-creator-to = hasta
video-creator-step = , paso
video-creator-ticks-step = Tiempo por paso (ms):
video-creator-prev-action = Anterior
video-creator-next-action = Proximo
video-creator-size = tamaño:
video-creator-step-count = Número de pasos:
video-creator-target-same-pixel-ratio = Dirige la misma ratio de píxeles
video-creator-target-tooltip = Ajusta la magnitud del ancho de los líneas, el tamaño de puntos, el tamaño de etiquetas, etc.
video-creator-ffmpeg-loading = FFmpeg cargando...
video-creator-ffmpeg-fail = Si eso no funciona en unos segundos, prueba recargando la página o informando los devs de DesModder sobre el error.
video-creator-exporting = Exportando...
video-creator-cancel-capture = Cancela
video-creator-cancel-export = Cancela
video-creator-capture = Captura
video-creator-preview = Avance
video-creator-delete-all = elimina todo
video-creator-filename-placeholder = pone un nombre para el archivo...
video-creator-export = Exporta
video-creator-export-as = Exporta como { $fileType }
video-creator-fps = FPS:
video-creator-method-once = una vez
video-creator-method-slider = slider
video-creator-method-action = acción
video-creator-method-ticks = segunditas

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
better-evaluation-view-name = Mejor Vista de Evaluación
better-evaluation-view-desc =  Dispone elementos en listas, colores, y los números indefinidos.
better-evaluation-view-opt-lists-name = Dispone los elementos en listas
better-evaluation-view-opt-lists-desc = Dispone los elementos en listas en vez de la longitud en las listas.
better-evaluation-view-opt-colors-name = Mostra colores
better-evaluation-view-opt-colors-desc = Mostra colores como valores rgb
better-evaluation-view-opt-colorLists-name = Mostra listas de colores
better-evaluation-view-opt-colorLists-desc = Mostra listas de colores como listas de valores rgb
