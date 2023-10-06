# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Harcdoded in the Typescript:
# [pluginID]-name = 名前
# [pluginID]-desc = 説明
# [pluginID]-opt-[optionKey]-name = オプション名
# [pluginID]-opt-[optionKey]-desc = オプション説明

## General
menu-learn-more = 詳細
menu-desmodder-plugins = DesModderプラグイン
menu-desmodder-tooltip = DesModderメニュー

## Category names
category-core-name = コア
category-utility-name = 用途
category-visual-name = 表示
category-integrations-name = 統合

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = GPUでレンダリングする。タブのリロードで無効になります。まれにUIが遅くなったり、フリーズすることがあります。問題がある場合はページをリロードしてください。
GLesmos-label-toggle-glesmos = GLesmosを使ったレンダリング
GLesmos-confirm-lines = ラインの確認
GLesmos-confirm-lines-body = GLesmosのライン・レンダリングは遅いことがあります。特にレイヤーのリストには注意してください。
GLesmos-no-support = 残念ながら、あなたのブラウザはWebGL2をサポートしていないため、GLesmosをサポートしていません。
# Missing: error messages

## Tips
show-tips-name = ヒントの表示
show-tips-desc = 表現リストの一番下にヒントを表示する
show-tips-tip-export-videos = 動画をエクスポートする場合は、GIFよりもMP4またはAPNGを優先する。
show-tips-tip-disable-graphpaper = 電卓の設定でグラフ用紙を無効にすると、一連の方程式を書くのに便利です。
show-tips-tip-paste-asciimath = Desmosに直接ASCII Mathを貼り付ける
show-tips-tip-pin = よく使う表現をブックマークしてアクセスを簡略化
show-tips-tip-long-video-capture = 長いビデオキャプチャを開始する前に、テストする事を推奨します。
show-tips-tip-find-replace = 検索と置換は変数名の変更に最適です。
show-tips-tip-duplicate = Ctrl+Q または Ctrl+Shift+Q を押して、現在の式を複製する。
show-tips-tip-note-newline = ノートやフォルダのタイトルで Shift+Enter を押下すると改行されます。
show-tips-tip-hide-errors = 黄色の三角形をクリック（またはShift+Enter）すると、警告が非表示になります。
show-tips-tip-note-folder =  " を押下すると、フォルダを素早く作成できる。
show-tips-tip-arctan = 点の角度を求めるには、arctan(y / x)の代わりにarctan(y, x)を使ってください。
show-tips-tip-indefinite-integral = 積分は無限境界を持つことができます。
show-tips-tip-random = ランダム関数は、次のような分布からサンプリングすることができます。
show-tips-tip-two-argument-round = Two-argument round は四捨五入ラベルに最適です。
show-tips-tip-two-argument-sort = sort(A, B)を使って、あるリストを別のリストのキーでソート出来ます。
show-tips-tip-custom-colors = rgb関数とhsv関数を使ってカスタムカラーを作成する事が出来ます。
show-tips-tip-ctrl-f = Ctrl+F で式を検索出来ます。
show-tips-tip-derivatives = 素数表記法またはライプニッツ表記法を用いて導関数をとる事が出来ます。
show-tips-tip-unbounded-list-slices = List slices は境界を持つ必要はありません。
show-tips-tip-dataviz-plots = データを視覚化するには、ヒストグラムやボックスプロットなどを使用できます。
show-tips-tip-statistics = Desmosには多くの統計機能が組み込まれています。
show-tips-tip-table-draggable-points = ドラッグ可能な点のリストにはテーブルを使用してください。
show-tips-tip-polygon = 簡単な多角形には多角形関数を使用します。
show-tips-tip-point-arithmetic = 点（ベクトル）演算は期待通りに機能します。例：（1, 2）＋（3, 4）は（4, 6）。
show-tips-tip-shift-drag = Shiftキーを押しながら軸の上をドラッグすると、その軸だけを拡大縮小することができます。
show-tips-tip-action-ticker = actions と tickers を使用してシミュレーションを実行します。
show-tips-tip-latex-copy-paste = Desmosの数式は、LaTeXエディタに直接コピーペーストできます。
show-tips-tip-time-in-worker = グラフの実行速度をテストするには、?timeInWorkerを使用するか、パフォーマンス表示プラグインを有効にしてください。
show-tips-tip-format-labels = backticks を使ってポイントラベルを数学フォーマットする
show-tips-tip-dynamic-labels = 変数に基づく動的なポイントラベルに ${"{"} {"}"} を使用する。
show-tips-tip-disable-text-outline = テキストのアウトラインを無効にすると、ラベルが読みやすくなることがあります。
show-tips-tip-regression-power = regression はあなたが想像している以上に強力です。
show-tips-tip-spreadsheet-table = スプレッドシートのデータを貼り付けて表を作成できます。
show-tips-tip-keyboard-shortcuts = Ctrl+/ か Cmd+/ でキーボードショートカットのリストを開けます。
show-tips-tip-listcomps = リスト内包は、点のグリッドや多角形のリストに最適です。
show-tips-tip-list-filters = リストフィルターは、正要素や偶数要素などのフィルターに使用できます。
show-tips-tip-bernard = Bernard
show-tips-tip-new-desmos = Desmos の新着情報
show-tips-tip-simultaneous-actions =アクションの割り当ては順次ではなく、同時に行われる。
show-tips-tip-share-permalink = サインインしなくても、パーマリンク経由でグラフを共有できます。
show-tips-tip-point-coordinate = ポイント変数に .x または .y を追加して、ポイントの x 座標または y 座標を抽出します。
show-tips-tip-audiotrace = Audio Traceを使ってグラフを聴きます。
show-tips-tip-audiotrace-note-frequency = オーディオトレースの周波数は、ビューポート内の高さまたは低さに依存します。
show-tips-tip-audiotrace-range = オーディオ・トレースの範囲はE4（329.63Hz）からE5（659.25Hz）までです。
show-tips-tip-other-calculators = Desmosには他にも電卓があります。
show-tips-tip-lock-viewport = ビューポートを移動させたくない場合はグラフ設定でロックしてください。
show-tips-tip-glesmos = GLesmosプラグインを有効にして、いくつかの内含を高速化する。
show-tips-tip-disable-show-tips = ヒントを非表示にするにはDesmodderの設定で「ヒントを表示」プラグインを無効にしてください。
show-tips-tip-compact-view-multiline = コンパクト・ビューやマルチライン式を有効にして、一度に多くの式を見ることができます。
show-tips-tip-intellisense = 長い変数名が多い場合、Intellisenseを有効にして、簡単に扱えるようにしましょう。
show-tips-tip-youre-doing-great = あなたはよく頑張っています :)
show-tips-tip-youre-superb = あなたは素晴らしい <3
show-tips-tip-huggy = Huggy!

## Text Mode
text-mode-name = テキストモードBETA
text-mode-desc = バグの可能性があります。一時的なドキュメント：
text-mode-toggle = テキストモードの切り替え
# Missing: error messages

## Debug Mode
debug-mode-name = デバッグモード
debug-mode-desc = インデックスの代わりに式IDを表示する

## Find and Replace
find-and-replace-name = 検索と置換
find-and-replace-desc = Ctrl+Fメニューに "replace all" ボタンが追加され、変数名や関数名の一括置換ができるようになりました。
find-and-replace-replace-all = replace all

## Wolfram To Desmos
wolfram2desmos-name = Wolfram から Desmos
wolfram2desmos-desc = ASCII数学（Wolfram Alphaクエリの結果等）をDesmosに貼り付けることができます。
wolfram2desmos-opt-reciprocalExponents2Surds-name = ラジカル記法
wolfram2desmos-opt-reciprocalExponents2Surds-desc = 1未満の小数の累乗をラジカル等価（surd）に変換する。
wolfram2desmos-opt-derivativeLoopLimit-name = デリバティブの拡大
wolfram2desmos-opt-derivativeLoopLimit-desc = ライプニッツ記法のn階微分を反復微分に展開する。（10回まで）

## Pin Expressions
pin-expressions-name = ブックマーク表現
pin-expressions-desc = リスト編集モードからのブックマーク表現
pin-expressions-pin = 固定
pin-expressions-unpin = 外す

## Builtin Settings
builtin-settings-name = 電卓の設定
builtin-settings-desc = Desmosに組み込まれている機能を切り替えます。ほとんどのオプションは自分のブラウザにのみ適用され、他の人とグラフを共有するときは無視されます。
builtin-settings-opt-advancedStyling-name = 高度なスタイリング
builtin-settings-opt-advancedStyling-desc = ラベル編集、show-on-hover、テキストアウトライン、1象限グリッドを有効にする。
builtin-settings-opt-graphpaper-name = Graphpaper
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = 管理者の特徴
builtin-settings-opt-authorFeatures-desc = 隠しフォルダの切り替え、読み取り専用の切り替えなど
builtin-settings-opt-pointsOfInterest-name = 注目ポイントを表示
builtin-settings-opt-pointsOfInterest-desc = Intercepts, holes, intersectionsなど
builtin-settings-opt-trace-name = 曲線に沿ってなぞる
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = 表現の表示
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = ズームボタンの表示
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-expressionsTopbar-name = Expressionsのトップバーの表示
builtin-settings-opt-expressionsTopbar-desc = {""}
builtin-settings-opt-border-name = ボーダー
builtin-settings-opt-border-desc = 電卓の周りのボーダー
builtin-settings-opt-keypad-name = keypadの表示
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-qwertyKeyboard-name = QWERTY Keyboard
builtin-settings-opt-qwertyKeyboard-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = 式の複製ホットキー
duplicate-expression-hotkey-desc = 選択した式を複製するには、Ctrl+QまたはCtrl+Shift+Qを入力します。

## Right Click Tray
right-click-tray-name = 右クリックトレイ
right-click-tray-desc = 設定バブルを左クリックしたままではなく、右クリックで設定トレイを開けるようにする。

## Set Primary Color
set-primary-color-name = 原色設定
set-primary-color-desc = ユーザーインターフェースの原色を選ぶ
set-primary-color-opt-primaryColor-name = 原色
set-primary-color-opt-primaryColor-desc = 電卓全体の原色
set-primary-color-opt-doFavicon-name = サイトアイコンの更新
set-primary-color-opt-doFavicon-desc = サイトアイコンの更新の切り替え

## Hide Errors
hide-errors-name = エラーの非表示
hide-errors-desc = エラーの三角形をクリックすると非表示になります。
hide-errors-hide = hide

## Folder Tools
folder-tools-name = Folder Tools
folder-tools-desc = 編集-リスト-モード でフォルダを管理するのに役立つボタンを追加します。
folder-tools-dump = Dump
folder-tools-merge = Merge
folder-tools-enclose = Enclose

## Video Creator
video-creator-name = ビデオクリエーター
video-creator-desc = アクションやスライダーに基づいてグラフのビデオやGIFをエクスポートできます。
video-creator-menu = ビデオクリエーターメニュー
video-creator-to = to
video-creator-step = , ステップ
video-creator-ticks-step = タイムステップ (ms):
video-creator-prev-action = 前へ
video-creator-next-action = 次へ
video-creator-size = サイズ:
video-creator-step-count = ステップ数:
video-creator-target-same-pixel-ratio = 目標同一ピクセル比
video-creator-target-tooltip = 線幅、ポイントサイズ、ラベルサイズなどのスケーリングを調整します。
video-creator-ffmpeg-loading = FFmpeg loading...
video-creator-ffmpeg-fail = 数秒以内にうまくいかない場合は、ページをリロードするか、このバグをDesModder開発者に報告してみてください。
video-creator-exporting = Exporting...
video-creator-cancel-capture = キャンセル
video-creator-cancel-export = キャンセル
video-creator-capture = キャプチャー
video-creator-preview = プレビュー
video-creator-delete-all = 全削除
video-creator-filename-placeholder = ファイル名の設定
video-creator-export = エクスポート
video-creator-export-as = { $fileType } としてエクスポート
video-creator-fps = FPS:
video-creator-method-once = 1度だけ
video-creator-method-slider = スライダー
video-creator-method-action = アクション
video-creator-method-ticks = ticks

## Shift+Enter Newline
shift-enter-newline-name = Shift+Enter Newline
shift-enter-newline-desc = Shift+Enterキーを使って、ノートや画像/フォルダタイトルに改行を入力します。

## Wakatime
wakatime-name = WakaTime
wakatime-desc = WakaTime.comでdesmosのアクティビティを追跡します。
wakatime-opt-secretKey-name = Secret Key
wakatime-opt-secretKey-desc = WakaTimeサーバーで使用するAPIキー
wakatime-opt-splitProjects-name = グラフでプロジェクトを分割する。
wakatime-opt-splitProjects-desc = 各グラフをDesmosプロジェクトのブランチとしてではなく、独自のプロジェクトとして保存する。
wakatime-opt-projectName-name = Project name
wakatime-opt-projectName-desc = WakaTimeから見ることができ、すべてのDesmosプロジェクトで共有されます。

## Performance Display
performance-info-name = Performance Display
performance-info-desc = 現在のグラフのパフォーマンスに関する情報を表示する。
performance-info-refresh-graph = Refresh Graph
performance-info-refresh-graph-tooltip = 初期ロード時間をテストするためにグラフを更新する。
performance-info-sticky-tooltip = メニューを開いたままにする
performance-info-time-in-worker = 実行時間
performance-info-compiling = Compiling
performance-info-rendering = Rendering
performance-info-other = Other

## Better Evaluation View
better-evaluation-view-name = Better Evaluation View
better-evaluation-view-desc = リスト要素、色、未定義の値を表示する
better-evaluation-view-opt-lists-name = Show list elements
better-evaluation-view-opt-lists-desc = リストの長さの代わりにリストの要素を表示する
better-evaluation-view-opt-colors-name = Show colors
better-evaluation-view-opt-colors-desc = 色をrgb値で表示する
better-evaluation-view-opt-colorLists-name = Show lists of colors
better-evaluation-view-opt-colorLists-desc = 色のリストをrgb値のリストとして表示する。

## Pillbox Menus
pillbox-menus-name = Pillbox Menus (Core)
pillbox-menus-desc = Video CreatorやDesModderのメインメニューなど、右側のボタンを表示する。

## Manage Metadata
manage-metadata-name = Manage Metadata (Core)
manage-metadata-desc = GLesmosや固定/非固定のステータスなどのメタデータを管理する。

## Intellisense
intellisense-name = Intellisense
intellisense-desc = オートコンプリート候補、関数呼び出しヘルプ、定義へのジャンプなど、いくつかの一般的なIDE機能をDesmosにもたらします。ドキュメントはこちら:
intellisense-opt-subscriptify-name = 自動添え字
intellisense-opt-subscriptify-desc = 変数名/関数名が添え字なしで入力されると、自動的に添え字が追加されます。
intellisense-jump2def-menu-instructions = 複数の定義があります。以下から選んでジャンプしてください。

## Compact View
compact-view-name = Compact View
compact-view-desc = UIを凝縮し、一度に画面上の多くを見ることができるようにするためのさまざまなオプションを提供します。
compact-view-opt-textFontSize-name = Text Font Size
compact-view-opt-textFontSize-desc = フォントの大きさ
compact-view-opt-mathFontSize-name = Math Font Size
compact-view-opt-mathFontSize-desc = 数式中のフォントサイズ
compact-view-opt-bracketFontSizeFactor-name = Bracket Multiplier
compact-view-opt-bracketFontSizeFactor-desc = 括弧（括弧、中括弧など）内のテキストは、この倍数だけサイズが小さくなる。
compact-view-opt-minimumFontSize-name = Min Font Size
compact-view-opt-minimumFontSize-desc = 可能な最小の数学フォントサイズ（ブラケット・フォントサイズ係数より優先される）
compact-view-opt-compactFactor-name = Remove Spacing
compact-view-opt-compactFactor-desc = エクスプレッション・リストの空白スペースを削除します。
compact-view-opt-noSeparatingLines-name = No Separating lines
compact-view-opt-noSeparatingLines-desc = 式と式の間の区切り線を削除し、交互の色に置き換えます。
compact-view-opt-highlightAlternatingLines-name = Highlight Alternating Lines
compact-view-opt-highlightAlternatingLines-desc = 交互に表現される表現にハイライトを入れ、互いに区別しやすくする。
compact-view-opt-hideEvaluations-name = Collapse Evaluations
compact-view-opt-hideEvaluations-desc = 評価を横に表示します。フォーカスしたり、カーソルを合わせると表示されます。

## Multiline
multiline-name = Multiline Expressions
multiline-desc = 式を複数行に分割して、利用可能なスペースをより有効に活用します。Ctrl+M で手動で実行できます。
multiline-opt-widthBeforeMultiline-name = Width Threshold (%)
multiline-opt-widthBeforeMultiline-desc = 折り返しが発生する最小幅（ビューポートサイズに対するパーセンテージ）。モバイルでは、この値は3倍になります。
multiline-opt-automaticallyMultilinify-name = Automatically Multilinify
multiline-opt-automaticallyMultilinify-desc = 式を自動的に複数行に分割します。
multiline-opt-multilinifyDelayAfterEdit-name = Edit Delay (ms)
multiline-opt-multilinifyDelayAfterEdit-desc = 多行式は、このミリ秒の間、編集が行われなかった後に更新されるべきである。

## Custom MathQuill Config
custom-mathquill-config-name = Custom MathQuill Config
custom-mathquill-config-desc = 方程式の入力方法を変更する。
custom-mathquill-config-opt-superscriptOperators-name = Operators in Exponents
custom-mathquill-config-opt-superscriptOperators-desc = 指数に "+" のような演算子を入力できるようにする。
custom-mathquill-config-opt-noAutoSubscript-name = 自動添え字を無効
custom-mathquill-config-opt-noAutoSubscript-desc = 変数名の後に入力された数字を添え字に自動的に入れるのを無効にする
custom-mathquill-config-opt-noNEquals-name = Disable n= Sums
custom-mathquill-config-opt-noNEquals-desc = 下限に'n='を自動的に置く和を無効にする。
custom-mathquill-config-opt-subSupWithoutOp-name = オペランドなしの添え字/上付き文字
custom-mathquill-config-opt-subSupWithoutOp-desc = 下付き文字と上付き文字は、前に何も付いていなくても指定できる。
custom-mathquill-config-opt-allowMixedBrackets-name = 不一致のブラケットを許可
custom-mathquill-config-opt-allowMixedBrackets-desc = すべての括弧が互いに一致するようにする（絶対値を含む）
custom-mathquill-config-opt-subscriptReplacements-name = 添え字の置換を許可
custom-mathquill-config-opt-subscriptReplacements-desc = 記号や関数名を添え字で入力できるようにする
custom-mathquill-config-opt-noPercentOf-name = Disable % of
custom-mathquill-config-opt-noPercentOf-desc = '%'と入力すると、'% of'の代わりにパーセント文字が挿入される。
custom-mathquill-config-opt-commaDelimiter-name = Comma Separators
custom-mathquill-config-opt-commaDelimiter-desc = 数値の区切り文字としてカンマを挿入する
custom-mathquill-config-opt-delimiterOverride-name = Custom Delimiter
custom-mathquill-config-opt-delimiterOverride-desc = 数値の区切り文字として使用する文字列を設定する
custom-mathquill-config-opt-leftIntoSubscript-name = Left/Right into Subscripts
custom-mathquill-config-opt-leftIntoSubscript-desc = カーソルを左右に動かすと、上付き文字ではなく下付き文字になる
custom-mathquill-config-opt-extendedGreek-name = More Greek Letters
custom-mathquill-config-opt-extendedGreek-desc = サポートされているすべてのギリシャ文字の置き換えを有効にする
