# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Harcdoded in the Typescript:
# [pluginID]-name = Name
# [pluginID]-desc = Description
# [pluginID]-opt-[optionKey]-name = Option Name
# [pluginID]-opt-[optionKey]-desc = Option Description

## General
menu-learn-more = En-savoir plus
menu-desmodder-plugins = DesModder Plugins
menu-desmodder-tooltip = Parametre de DesModder

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = Rendre les implicites sur le GPU. Désactive sur rechargement de l'onglet. Dans des rares cas, peut causait l'onglet de s'arreter; reload the page if you have issues.
GLesmos-label-toggle-glesmos = Rendre avec GLesmos
# Missing: error messages

## Tips
show-tips-name = Afficher des conseils
show-tips-desc = Afficher les conseils au bas de la liste des expressions.
# Missing: all tips. Is it worthwhile?

## Text Mode
text-mode-name = Mode Text BETA
text-mode-desc = attendez-vous au bugs. Documentation temporaire:
text-mode-toggle = Option Text Mode
# Missing: error messages

## Debug Mode
debug-mode-name = Mode débogage
debug-mode-desc = Montrer les indentifiant d'expression pluto que les indices

## Find and Replace
find-and-replace-name = Trouver et remplacer
find-and-replace-desc = Ajoute un bouton "remplacer tout" dans le menu Ctrl+F pour refactoriser plus facilement les noms de variables/fonctions.

find-and-replace-replace-all = Tout Remplacer

## Wolfram To Desmos
wolfram2desmos-name = Wolfram à Desmos
wolfram2desmos-desc = Coller des expression de mathématiques ASCII (comme les résultats de Wolfram Alpha) dans Desmos
wolfram2desmos-opt-reciprocalExponents2Surds-name = Notation Radical
wolfram2desmos-opt-reciprocalExponents2Surds-desc = Conversion de puissances fractionnaires inférieures powers à un en radical équivalent (surd)
wolfram2desmos-opt-derivativeLoopLimit-name = Développer les dérivés
wolfram2desmos-opt-derivativeLoopLimit-desc = Développer les nth dérivés de notation Leivniz en dérivés répétés (limité à 10)

## Pin Expressions
pin-expressions-name = Épingler l'expression
pin-expressions-desc = Épingler l'expression depuis Edit List mode
pin-expressions-pin = Épingler
pin-expressions-unpin = Épingler

## Builtin Settings
builtin-settings-name = Paramètres
builtin-settings-desc = Lets you toggle features built-in to Desmos. Most options apply only to your own browser and are ignored when you share graphs with others.
builtin-settings-desc = Permet l'utilisation de fonctionnalités intégrées à Desmos. La plupart des option appliquent uniquement à votre navigateure et sont ignorées lorsque vous partagez des graphiques avec d'autres.
builtin-settings-opt-advancedStyling-name = Outils de style avancé
builtin-settings-opt-advancedStyling-desc = Permet l'édition d'étiquettes, l'affichage au survol, le contour du texte et la grille à un quadrant
builtin-settings-opt-graphpaper-name = Tableau Graphiques
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-administerSecretFolders-name = Créer des dossiers cachés
builtin-settings-opt-administerSecretFolders-desc = {""}
builtin-settings-opt-pointsOfInterest-name = Afficher les points d'intérêt
builtin-settings-opt-pointsOfInterest-desc = Interception, trous , intersections, etc.
builtin-settings-opt-trace-name = Trace des courbes
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = Afficher les expression
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = Afficher le navigateur de zoom
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Afficher le bar en haut du bar d'expression
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = Cadre
builtin-settings-opt-border-desc = Cadre subtile autour de la calculatrice
builtin-settings-opt-keypad-name = Afficher le clavier
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = Clavier QWERTY
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Touche de raccourci d'expression en double
duplicate-expression-hotkey-desc = Tapez Ctrl+Q ou Ctrl+Maj+Q pour dupliquer l'expression sélectionnée.

## Right Click Tray
right-click-tray-name = Clic droit pour options
right-click-tray-desc = Permets l'utilisation d'un clic droit au lieu d'avoir à maintenir le clic gauche pour ouvire le dialgue d'options (style circulaire)

## Set Primary Color
set-primary-color-name = Définir la couleur primaire
set-primary-color-desc = Définir la couleur primaire pour l'interface utilisateur
set-primary-color-opt-primaryColor-name = Couleur Primaire
set-primary-color-opt-primaryColor-desc = Couleur Primaire pour la calculatrice
set-primary-color-opt-doFavicon-name = Changer l'icône du site
set-primary-color-opt-doFavicon-desc = {""}

## Hide Errors
hide-errors-name = Cacher les erreurs
hide-errors-desc = Click error triangles to fade them and hide suggested sliders.
hide-errors-hide = Cacher

## Folder Tools
folder-tools-name = Outils de dossier
folder-tools-desc = Ajoute des boutons en mode revision de liste pour aider à gérer les dossiers.
folder-tools-dump = Décharger
folder-tools-merge = Fusionner
folder-tools-enclose = Enfermer

## Video Creator
video-creator-name = Créateur de vidéos
video-creator-desc = Créer des vidéos et des GIFs de vos graphiques en fonction d'actions ou de curseurs.
video-creator-menu = Menu du créateur de vidéos
video-creator-to = à
video-creator-step = , étape
video-creator-prev-action = Précédent
video-creator-next-action = Suivant
video-creator-size = Taille:
video-creator-step-count = Nombe d'étape:
video-creator-target-same-pixel-ratio = Cibler le même ratio de pixels
video-creator-target-tooltip = Ajuste la mise à l'échelle de la largeur de ligne, de la taille des points, de la taille de l'étiquette, etc.
video-creator-ffmpeg-loading = Chargement de FFmpeg...
video-creator-ffmpeg-fail = Si cela ne fonctionne pas dans quelque instants, essayez de recharger la page ou de signaler ce bogue aux développeurs de DesModder.
video-creator-exporting = Rendition en cours...
video-creator-cancel-capture = Annuler
video-creator-cancel-export = Annuler
video-creator-capture = Enregistrer
video-creator-preview = Avant-première
video-creator-delete-all = Tout Suprimer
video-creator-filename-placeholder = définir le nom de fichier
video-creator-export = Créer
video-creator-export-ff = Créer (Avertissement : actuellement peu fiable/lent dans Firefox)
video-creator-export-as = Créer comme { $fileType }
video-creator-fps = Images par seconde:
video-creator-method-once = unique
video-creator-method-slider = curseurs
video-creator-method-action = action

## Shift+Enter Newline
shift-enter-newline-name = Maj+Entrée Nouvelle Ligne
shift-enter-newline-desc = Utilisez Maj+Entrée pour taper des retours à la ligne dans les notes et les titres des images/dossiers.
