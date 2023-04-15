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

## Category names
category-core-name = Essentiel
category-utility-name = Utilitaire
category-visual-name = Visuel
category-integrations-name = Intégrations

## GLesmos
# Unchanged
GLesmos-name = GLesmos
GLesmos-desc = Rendre les implicites sur le GPU. Désactive sur rechargement de l'onglet. Dans des rares cas, peut causait l'onglet de s'arreter; rechargez la page si vous rencontrez des problèmes.
GLesmos-label-toggle-glesmos = Rendre avec GLesmos
GLesmos-confirm-lines = Confirmer les lignes
GLesmos-confirm-lines-body = Le rendu des lignes GLesmos peut être lent. Soyez prudent, surtout pour une liste de calques.
# Missing: error messages

## Tips
show-tips-name = Afficher des Conseils
show-tips-desc = Afficher les conseils au bas de la liste des expressions.
# Missing: all tips. Is it worthwhile?

## Text Mode
text-mode-name = Mode Text BETA
text-mode-desc = Attendez-vous au bugs. Documentation temporaire:
text-mode-toggle = Option Text Mode
# Missing: error messages

## Debug Mode
debug-mode-name = Mode débogage
debug-mode-desc = Montrer les indentifiant d'expression pluto que les indices

## Find and Replace
find-and-replace-name = Trouver et remplacer
find-and-replace-desc = Ajoute un bouton "remplacer tout" dans le menu Ctrl+F pour refactoriser plus facilement les noms de variables/fonctions.
find-and-replace-replace-all = tout remplacer

## Wolfram To Desmos
wolfram2desmos-name = Wolfram à Desmos
wolfram2desmos-desc = Coller des expression de mathématiques ASCII (comme les résultats de Wolfram Alpha) dans Desmos
wolfram2desmos-opt-reciprocalExponents2Surds-name = Notation Radical
wolfram2desmos-opt-reciprocalExponents2Surds-desc = Conversion de puissances fractionnaires inférieures powers à un en radical équivalent (surd)
wolfram2desmos-opt-derivativeLoopLimit-name = Développer les Dérivés
wolfram2desmos-opt-derivativeLoopLimit-desc = Développer les nth dérivés de notation Leivniz en dérivés répétés (limité à 10)

## Pin Expressions
pin-expressions-name = Épingler l'Expression
pin-expressions-desc = Épingler l'Expression depuis Edit List mode
pin-expressions-pin = Épingler
pin-expressions-unpin = Détacher

## Builtin Settings
builtin-settings-name = Paramètres
builtin-settings-desc = Permet l'utilisation de fonctionnalités intégrées à Desmos. La plupart des option appliquent uniquement à votre navigateure et sont ignorées lorsque vous partagez des graphiques avec d'autres.
builtin-settings-opt-advancedStyling-name = Outils de Style Avancé
builtin-settings-opt-advancedStyling-desc = Permet l'édition d'étiquettes, l'affichage au survol, le contour du texte et la grille à un quadrant
builtin-settings-opt-authorFeatures-name = Tableau Graphiques
# Unchanged
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-pointsOfInterest-name = Afficher les points d'intérêt
builtin-settings-opt-pointsOfInterest-desc = Interception, trous, intersections, etc.
builtin-settings-opt-trace-name = Trace des Courbes
# Unchanged
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = Afficher les expression
# Unchanged
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = Afficher le navigateur de zoom
# Unchanged
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Afficher le bar en haut du bar d'expression
# Unchanged
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = Cadre
builtin-settings-opt-border-desc = Cadre subtile autour de la calculatrice
builtin-settings-opt-keypad-name = Afficher le Clavier
# Unchanged
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = Clavier QWERTY
# Unchanged
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = Touche de raccourci d'expression en double
duplicate-expression-hotkey-desc = Tapez Ctrl+Q ou Ctrl+Maj+Q pour dupliquer l'expression sélectionnée.

## Right Click Tray
right-click-tray-name = Clic droit pour options
right-click-tray-desc = Permets l'utilisation d'un clic droit au lieu d'avoir à maintenir le clic gauche pour ouvire le dialgue d'options (style circulaire)

## Set Primary Color
set-primary-color-name = Définir la Couleur Primaire
set-primary-color-desc = Définir la couleur primaire pour l'interface utilisateur
set-primary-color-opt-primaryColor-name = Couleur Primaire
set-primary-color-opt-primaryColor-desc = Couleur Primaire pour la calculatrice
set-primary-color-opt-doFavicon-name = Changer l'Icône du Site
set-primary-color-opt-doFavicon-desc = {""}

## Hide Errors
hide-errors-name = Cacher les Erreurs
hide-errors-desc = Click error triangles to fade them and hide suggested sliders.
hide-errors-hide = Cacher

## Folder Tools
folder-tools-name = Outils de Dossier
folder-tools-desc = Ajoute des boutons en mode revision de liste pour aider à gérer les dossiers.
folder-tools-dump = Décharger
folder-tools-merge = Fusionner
folder-tools-enclose = Enfermer

## Video Creator
video-creator-name = Créateur de Vidéos
video-creator-desc = Créer des vidéos et des GIFs de vos graphiques en fonction d'actions ou de curseurs.
video-creator-menu = Menu du Créateur de Vidéos
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
video-creator-export-as = Créer comme { $fileType }
video-creator-fps = Images par seconde:
video-creator-method-once = unique
video-creator-method-slider = curseurs
# Unchanged
video-creator-method-action = action

## Shift+Enter Newline
shift-enter-newline-name = Maj+Entrée Nouvelle Ligne
shift-enter-newline-desc = Utilisez Maj+Entrée pour taper des retours à la ligne dans les notes et les titres des images/dossiers.

## Wakatime
# Unchanged
wakatime-name = WakaTime
wakatime-desc = Suivez votre activité sur Desmos sur WakaTime.com
wakatime-opt-secretKey-name = Clef Secrète
wakatime-opt-secretKey-desc = Clé API utilisée pour les serveurs WakaTime
wakatime-opt-splitProjects-name = Diviser les projets par graphique
wakatime-opt-splitProjects-desc = Stockez chaque graphique comme son propre projet au lieu des branches d'un projet unifié
wakatime-opt-projectName-name = Nom du projet
wakatime-opt-projectName-desc = Visible depuis WakaTime, et partagé pour tous les projets Desmos

## Performance Display
performance-info-name = Affichage des Performances
performance-info-desc = Affiche des informations sur les performances du graphique actuel.
performance-info-refresh-graph = Actualiser le graphique
performance-info-refresh-graph-tooltip = Actualisez le graphique pour mesurer le temps de chargement initial
performance-info-sticky-tooltip = Garder le Menu Ouvert
# Unchanged
performance-info-time-in-worker = Time In Worker
performance-info-compiling = Compilation
performance-info-rendering = Rendition
performance-info-other = Autre

## Better Evaluation View
better-evaluation-view-name = Meilleure Vue d'évaluation
better-evaluation-view-desc = Affiche les éléments de la liste, les couleurs et les valeurs non définies
better-evaluation-view-opt-lists-name = Afficher les éléments du liste
better-evaluation-view-opt-lists-desc = Afficher les éléments du liste plutôt que la longeur du liste
better-evaluation-view-opt-colors-name = Afficher les couleurs
better-evaluation-view-opt-colors-desc = Afficher les couleurs comme des valeurs RGB
better-evaluation-view-opt-colorLists-name = Afficher les liste de couleurs
better-evaluation-view-opt-colorLists-desc = Afficher les liste de couleurs comme des valeurs RGB
