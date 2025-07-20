# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Hardcoded in the Typescript:
# [pluginID]-name = 名前
# [pluginID]-desc = 説明
# [pluginID]-opt-[optionKey]-name = オプション名
# [pluginID]-opt-[optionKey]-desc = オプション説明

## General
menu-learn-more = 詳細
menu-desmodder-plugins = DesModder プラグイン
menu-desmodder-tooltip = DesModder メニュー

## Category names
category-core-name = コア
category-utility-name = 操作
category-visual-name = 外観
category-integrations-name = インテグレーション

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = GPU でのレンダリング。まれに UI が遅くなったり、フリーズしたりすることがあります。問題がある場合はページを再読み込みしてください。
GLesmos-label-toggle-glesmos = GLesmos を使ったレンダリング
GLesmos-confirm-lines = 線のレンダリングの確認
GLesmos-confirm-lines-body = GLesmos の線のレンダリングは遅いことがあります。特にレイヤーのリストには注意してください。
GLesmos-no-support = 残念ながら、あなたのブラウザは WebGL2 をサポートしていないため、GLesmos はサポートされません。
GLesmos-not-enabled = このグラフの陰関数のパフォーマンスを向上させるために、GLesmos プラグインを有効にしてください。
# Missing: error messages

## Tips
show-tips-name = ヒントの表示
show-tips-desc = 数式リストの一番下にヒントを表示します。
show-tips-tip-export-videos = 動画をエクスポートする場合は、GIF よりも MP4 または APNG のほうがよいでしょう。
show-tips-tip-disable-graphpaper = 計算機の設定でグラフ用紙を無効にすると、一連の数式を書くのに便利です。
show-tips-tip-paste-asciimath = Desmos には直接 ASCII Math を貼り付けることができます。
show-tips-tip-pin = よく使う数式を固定（ブックマーク）してアクセスを簡略化できます。
show-tips-tip-long-video-capture = 長い動画のキャプチャをはじめる前にテストすることを推奨します。
show-tips-tip-find-replace = 検索と置換は変数名の変更に最適です。
show-tips-tip-duplicate = Ctrl+Q または Ctrl+Shift+Q を押下して、現在の式を複製できます。
show-tips-tip-note-newline = 説明文やフォルダーのタイトルで Shift+Enter を押下すると改行されます。
show-tips-tip-hide-errors = 黄色の三角形をクリック（または Shift+Enter を押下）すると、エラーが非表示になります。
show-tips-tip-note-folder =  " を押下すると、フォルダーを素早く作成できます。
show-tips-tip-arctan = 点の角度を求めるには、arctan(y / x) の代わりに arctan(y, x) を使ってください。
show-tips-tip-indefinite-integral = 積分範囲は無限区間にすることができます。
show-tips-tip-random = ランダム関数は分布からサンプリングすることができます。
show-tips-tip-two-argument-round = 2 引数の round 関数はラベルでの丸めに最適です。
show-tips-tip-two-argument-sort = sort(A, B) を使って、別のリストをキーとしてあるリストをソートできます。
show-tips-tip-custom-colors = rgb 関数と hsv 関数を使ってカスタムカラーを作成することができます。
show-tips-tip-ctrl-f = Ctrl+F で数式を検索できます。
show-tips-tip-derivatives = ラグランジュ記法またはライプニッツ記法を用いて導関数をとることができます。
show-tips-tip-unbounded-list-slices = リストのスライスは終了位置を必要としません。
show-tips-tip-dataviz-plots = データを視覚化するには、ヒストグラムや箱ひげ図などが使用できます。
show-tips-tip-statistics = Desmos には多くの統計機能が組み込まれています。
show-tips-tip-table-draggable-points = ドラッグ可能な点のリストには表を使用してください。
show-tips-tip-polygon = 簡単な多角形には polygon 関数を使用してください。
show-tips-tip-point-arithmetic = 点（ベクトル）演算は期待通りに機能します。例: (1, 2) + (3, 4) = (4, 6)
show-tips-tip-shift-drag = Shift キーを押しながら軸の上をドラッグすると、その軸だけを拡大縮小することができます。
show-tips-tip-action-ticker = アクションとティッカーを使うとシミュレーションを実行できます。
show-tips-tip-latex-copy-paste = Desmos の数式は、LaTeX エディタに直接コピー&ペーストできます。
show-tips-tip-time-in-worker = グラフの実行速度をテストするには、?timeInWorker を使用するか、パフォーマンス表示のプラグインを有効にしてください。
show-tips-tip-format-labels = 点のラベルを数式にするにはバッククォートを使ってください。
show-tips-tip-dynamic-labels = 変数に基づく動的な点のラベルには ${"{"} {"}"} を使ってください。
show-tips-tip-disable-text-outline = ラベルの輪郭を無効にすると読みやすくなることがあります。
show-tips-tip-regression-power = 回帰分析は想像以上に強力です。
show-tips-tip-spreadsheet-table = スプレッドシートのデータを貼り付けて表を作成できます。
show-tips-tip-keyboard-shortcuts = Ctrl+/ か Cmd+/ でキーボードショートカットのリストを開けます。
show-tips-tip-listcomps = リスト内包は、点のグリッドや多角形のリストに最適です。
show-tips-tip-list-filters = リストフィルターは、正の要素や偶数の要素などのフィルターに使用できます。
show-tips-tip-bernard = Bernard
show-tips-tip-new-desmos = Desmos の新着情報
show-tips-tip-simultaneous-actions =アクションの割り当ては順次ではなく、同時に行われます。
show-tips-tip-share-permalink = サインインしなくても、パーマリンク経由でグラフを共有できます。
show-tips-tip-point-coordinate = 点の変数に .x や .y を追加して、x 座標や y 座標を抽出できます。
show-tips-tip-audiotrace = オーディオトレースを使ってグラフを聴くことができます。
show-tips-tip-audiotrace-note-frequency = オーディオトレースの周波数は表示域内の高さまたは低さに依存します。
show-tips-tip-audiotrace-range = オーディオトレースの範囲は E4（329.63 Hz）から E5（659.25 Hz）までです。
show-tips-tip-other-calculators = Desmos には他にも計算機があります。
show-tips-tip-lock-viewport = 表示域を移動させたくない場合は、グラフの設定で固定してください。
show-tips-tip-glesmos = GLesmos プラグインを有効にすると、陰関数を高速化できます。
show-tips-tip-disable-show-tips = 私にはうんざり？ヒントを非表示にするには DesModder の設定でヒント表示のプラグインを無効にしてください。
show-tips-tip-compact-view-multiline = 数式のスクロールにうんざりしていませんか？小型ビューや複数行モードを有効にすると、すぐに数式の全体を見ることができます。
show-tips-tip-intellisense = 長い変数名が多すぎますか？インテリセンスを有効にして、簡単に扱えるようにしましょう。
show-tips-tip-youre-doing-great = あなたはよく頑張っています :)
show-tips-tip-youre-superb = あなたは素晴らしい <3
show-tips-tip-huggy = Huggy!

## Text Mode
text-mode-name = テキストモード（ベータ版）
text-mode-desc = バグがある可能性があります。一時的なドキュメントはこちら:
text-mode-toggle = テキストモードの切り替え
text-mode-toggle-spaces = スペース
text-mode-toggle-spaces-tooltip = 整形時、デリミタの後にスペースを挿入します。
text-mode-toggle-newlines = インデント
text-mode-toggle-newlines-tooltip = 整形時、改行とインデントを挿入します。
text-mode-format = 整形

## Find and Replace
find-and-replace-name = 検索と置換
find-and-replace-desc = Ctrl+F メニューに追加された「すべて置換」ボタンから、変数名や関数名の一括置換ができます。
find-and-replace-replace-all = すべて置換

## Wolfram To Desmos
wolfram2desmos-name = Wolfram から Desmos
wolfram2desmos-desc = ASCII Math（Wolfram Alpha クエリの結果など）を Desmos に貼り付けることができます。
wolfram2desmos-opt-reciprocalExponents2Surds-name = 根号表記
wolfram2desmos-opt-reciprocalExponents2Surds-desc = 自然数の逆数のべきを、それと等価な根号表記で書き換えます。
wolfram2desmos-opt-derivativeLoopLimit-name = 微分の展開
wolfram2desmos-opt-derivativeLoopLimit-desc = ライプニッツ記法の n 階微分を反復微分に展開します（10 回まで）。

## Pin Expressions
pin-expressions-name = 数式の固定
pin-expressions-desc = 「リストの編集」モードから数式を固定することができます。
pin-expressions-pin = 固定
pin-expressions-unpin = 固定を外す

## Builtin Settings
builtin-settings-name = 計算機の設定
builtin-settings-desc = Desmosに組み込まれている機能を切り替えます。ほとんどのオプションは自分のブラウザにのみ適用され、他の人とグラフを共有するときは無視されます。
builtin-settings-opt-advancedStyling-name = 高度なスタイリング
builtin-settings-opt-advancedStyling-desc = ラベルの編集、マウスホバー、ラベルの輪郭、第一象限の目盛を有効にします。
builtin-settings-opt-graphpaper-name = グラフ用紙を有効にする
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = 管理者機能
builtin-settings-opt-authorFeatures-desc = 隠しフォルダーの切り替え、読み取り専用の切り替えなどが有効になります。
builtin-settings-opt-pointsOfInterest-name = 注目すべき点を表示
builtin-settings-opt-pointsOfInterest-desc = 切片、除去可能な不連続点、交点などを表示します。
builtin-settings-opt-trace-name = 曲線に沿ってなぞる
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = 数式リストの表示
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = ズームボタンの表示
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-keypad-name = キーパッドの表示
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-showPerformanceMeter-name = パフォーマンスメーターを表示
builtin-settings-opt-showPerformanceMeter-desc = {""}
builtin-settings-opt-showIDs-name = ID を表示
builtin-settings-opt-showIDs-desc = 行番号の代わりに数式 ID を表示します。

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = 数式複製のホットキー
duplicate-expression-hotkey-desc = Ctrl+Q または Ctrl+Shift+Q を押下することで式を複製できます。

## Right Click Tray
right-click-tray-name = トレイの右クリック
right-click-tray-desc = 左クリックの長押しではなく右クリックで各数式の設定トレイを開けるようにします。

## Set Primary Color
set-primary-color-name = 基調色設定
set-primary-color-desc = UI の基調色を変更します。
set-primary-color-opt-primaryColor-name = 基調色
set-primary-color-opt-primaryColor-desc = 計算機全体の基調色
set-primary-color-opt-doFavicon-name = ファビコンに適用
set-primary-color-opt-doFavicon-desc = ファビコンにも基調色設定を適用します。

## Hide Errors
hide-errors-name = エラーの非表示
hide-errors-desc = エラーの三角形をクリックすることで非表示にします。
hide-errors-hide = 非表示

## Folder Tools
folder-tools-name = フォルダー管理ツール
folder-tools-desc = 「リストの編集」モード でフォルダー管理に役立つボタンを追加します。
folder-tools-dump = フォルダーを展開
folder-tools-merge = 下の数式やフォルダーと統合
folder-tools-enclose = フォルダーに包む

## Video Creator
video-creator-name = 動画作成
video-creator-desc = アクションやスライダーに基づいてグラフの動画や GIF をエクスポートできます。
video-creator-menu = 動画作成メニュー
video-creator-to = to
video-creator-step = , 主目盛
video-creator-ticks-playing-sliders = Playing sliders:
video-creator-ticks-step = タイムステップ（ms）:
video-creator-prev-action = 前へ
video-creator-next-action = 次へ
video-creator-orientation = Orientation
video-creator-orientation-mode-current-speed = current
video-creator-orientation-mode-current-delta = step
video-creator-orientation-mode-from-to = from/to
video-creator-size = サイズ:
video-creator-mosaic = モザイク:
video-creator-angle-current = Angle:
video-creator-angle-from = From:
video-creator-angle-to = To:
video-creator-angle-step = Step:
video-creator-angle-speed = Speed:
video-creator-step-count = ステップ数:
video-creator-frame-count = フレーム数:
video-creator-target-same-pixel-ratio = ピクセル比を揃える
video-creator-fast-screenshot = 高速キャプチャ
video-creator-target-tooltip = 線の幅、点のサイズ、ラベルサイズなどの拡大縮小を調整してピクセル比を揃える
video-creator-ffmpeg-loading = FFmpeg を読み込み中...
video-creator-ffmpeg-fail = 数秒以内にうまくいかない場合は、ページを再読み込みするか、このバグを DesModder 開発者に報告してみてください。
video-creator-exporting = エクスポート中...
video-creator-cancel-capture = キャンセル
video-creator-cancel-export = キャンセル
video-creator-capture = キャプチャ
video-creator-preview = プレビュー
video-creator-delete-all = 全フレームを削除
video-creator-filename-placeholder = ファイル名の設定
video-creator-export = エクスポート
video-creator-export-as = { $fileType } としてエクスポート
video-creator-fps = FPS:
video-creator-method-once = 1 度だけ
video-creator-method-ntimes = count
video-creator-method-slider = スライダー
video-creator-method-action = アクション
video-creator-method-ticks = ticks

## Wakatime
wakatime-name = WakaTime
wakatime-desc = WakaTime.com で Desmos のアクティビティを追跡します。
wakatime-opt-secretKey-name = API キー
wakatime-opt-secretKey-desc = WakaTime サーバーで使用する API キー
wakatime-opt-splitProjects-name = グラフでプロジェクトを分割する
wakatime-opt-splitProjects-desc = 各グラフを Desmos プロジェクトのブランチとしてではなく、独自のプロジェクトとして保存する
wakatime-opt-projectName-name = プロジェクト名
wakatime-opt-projectName-desc = WakaTime から見ることができ、すべての Desmos プロジェクトで共有されます。

## Performance Display
performance-info-name = パフォーマンス表示
performance-info-desc = 現在のグラフのパフォーマンスに関する情報を表示します。
performance-info-refresh-graph = グラフを更新
performance-info-refresh-graph-tooltip = 初期読み込み時間をテストするためにグラフを更新する
performance-info-sticky-tooltip = メニューを開いたままにする
performance-info-time-in-worker = 実行時間
performance-info-compiling = コンパイル
performance-info-rendering = レンダリング
performance-info-other = その他

## Better Evaluation View
better-evaluation-view-name = 評価ビューの改善
better-evaluation-view-desc = リストの要素、色、未定義の値を表示します。
better-evaluation-view-opt-floats-name = 特殊な浮動小数点値
better-evaluation-view-opt-floats-desc = 未定義の代わりに NaN/∞/-∞ を、 負のゼロに対して -0 を表示する
better-evaluation-view-opt-lists-name = リストの要素を表示
better-evaluation-view-opt-lists-desc = リストの長さの代わりに要素を表示する
better-evaluation-view-opt-colors-name = 色を表示
better-evaluation-view-opt-colors-desc = 色を RGB 値で表示する
better-evaluation-view-opt-colorLists-name = 色のリストを表示
better-evaluation-view-opt-colorLists-desc = 色のリストを RGB 値のリストとして表示する
better-navigation-opt-showScrollbar-name = スクロールバーを表示
better-navigation-opt-showScrollbar-desc = スクロールバーを表示または隠します。タッチデバイスではオフにすると使いやすくなります。

## Pillbox Menus
pillbox-menus-name = Pillbox Menus (Core)
pillbox-menus-desc = 動画作成メニューや DesModder のメインメニューなどの右側のボタンを表示します。

## Manage Metadata
manage-metadata-name = Manage Metadata (Core)
manage-metadata-desc = GLesmos や数式固定の状態などのメタデータを管理します。

## Intellisense
intellisense-name = インテリセンス
intellisense-desc = 自動補完、関数呼び出しのヘルプ、定義へのジャンプなど、一般的な IDE 機能を Desmos に追加します。ドキュメントはこちら:
intellisense-opt-subscriptify-name = 自動添え字
intellisense-opt-subscriptify-desc = 変数名 / 関数名が添え字なしで入力されると、自動的に添え字が追加されます。
intellisense-jump2def-menu-instructions = 複数の定義があります。以下から選んでジャンプしてください。

## Compact View
compact-view-name = 小型ビュー
compact-view-desc = UI を凝縮し、すぐに画面上の多くを見られるようにするためのさまざまなオプションを提供します。
compact-view-opt-textFontSize-name = 文字サイズ
compact-view-opt-textFontSize-desc = {""}
compact-view-opt-mathFontSize-name = 数式中文字サイズ
compact-view-opt-mathFontSize-desc = {""}
compact-view-opt-bracketFontSizeFactor-name = 括弧サイズの係数
compact-view-opt-bracketFontSizeFactor-desc = 括弧（丸括弧、波括弧など）内のテキストは、この分だけ文字サイズが小さくなります。
compact-view-opt-minimumFontSize-name = 最小文字サイズ
compact-view-opt-minimumFontSize-desc = ふさわしい最小の文字サイズ（括弧サイズの係数より優先されます）
compact-view-opt-compactFactor-name = スペースを削除
compact-view-opt-compactFactor-desc = 数式リストのスペースを削除
compact-view-opt-hideFolderToggles-name = フォルダーメニューを隠す
compact-view-opt-hideFolderToggles-desc = フォルダーの表示 / 非表示を切り替えたり最前面に表示したりするために追加されたフォルダーメニューを隠します。
compact-view-opt-noSeparatingLines-name = 区切り線を削除
compact-view-opt-noSeparatingLines-desc = 式と式の間の区切り線を削除し、1 行おきのハイライトで代替します。
compact-view-opt-highlightAlternatingLines-name = 数式を交互にハイライト
compact-view-opt-highlightAlternatingLines-desc = 数式を 1 行おきにハイライトし、互いに区別しやすくします。
compact-view-opt-hideEvaluations-name = 評価ビューを折りたたむ
compact-view-opt-hideEvaluations-desc = 数式の評価ビューを横に表示します。フォーカスしたり、カーソルを合わせたりすると表示されます。

## Multiline
multiline-name = 複数行モード
multiline-desc = 数式を複数行に分割します。
multiline-opt-widthBeforeMultiline-name = しきい値（%）
multiline-opt-widthBeforeMultiline-desc = 折り返しが発生する最小幅（表示域のサイズに対するパーセンテージ）。モバイルでは、この値は 3 倍になります。
multiline-opt-automaticallyMultilinify-name = 入力中に改行を挿入する
multiline-opt-automaticallyMultilinify-desc = 入力中に数式を自動的に複数行に分割するようにすると、Ctrl+M を使う必要がありません。
multiline-opt-multilinifyDelayAfterEdit-name = 更新間隔（ms）
multiline-opt-multilinifyDelayAfterEdit-desc = 複数行モードの自動折り返しは、ここで指定した時間編集が行われなければ更新されます。
multiline-opt-spacesToNewlines-name = スペースを改行に変換
multiline-opt-spacesToNewlines-desc = 3 つの半角スペースを改行に変換します。Shift+Enter を押下して改行することもできます。
multiline-opt-determineLineBreaksAutomatically-name = 自動で数式を折り返す
multiline-opt-determineLineBreaksAutomatically-desc = 改行位置を自動的に判断します。Ctrl+M を押下すると手動で改行できます。
multiline-opt-disableAutomaticLineBreaksForHandAlignedExpressions-name = 3 つの半角スペースを含む数式をスキップ
multiline-opt-disableAutomaticLineBreaksForHandAlignedExpressions-desc = 手動で追加した改行（3 つの半角スペース）がある数式には自動的に改行を追加しません。

## Custom MathQuill Config
custom-mathquill-config-name = MathQuill のカスタム設定
custom-mathquill-config-desc = 数式の入力方法を変更します。
custom-mathquill-config-opt-superscriptOperators-name = 指数での演算子入力
custom-mathquill-config-opt-superscriptOperators-desc = 指数に + のような演算子を入力できるようにします。
custom-mathquill-config-opt-noAutoSubscript-name = 自動添え字を無効化
custom-mathquill-config-opt-noAutoSubscript-desc = 変数名の後に入力された数字が自動で添え字に入る機能を無効にします。
custom-mathquill-config-opt-noNEquals-name = 総和の n= を無効化
custom-mathquill-config-opt-noNEquals-desc = 総和の下限に n= が自動的に入力される機能を無効にします。
custom-mathquill-config-opt-subSupWithoutOp-name = オペランドなしの上付き / 下付き文字
custom-mathquill-config-opt-subSupWithoutOp-desc = 上付き文字と下付き文字を、前に何も付いていなくても指定できるようにします。
custom-mathquill-config-opt-allowMixedBrackets-name = 括弧の不一致を許可
custom-mathquill-config-opt-allowMixedBrackets-desc = すべての括弧が互いに一致するようにします（絶対値を含む）。
custom-mathquill-config-opt-subscriptReplacements-name = 添え字の置換を許可
custom-mathquill-config-opt-subscriptReplacements-desc = 記号や関数名を添え字で入力できるようにします。
custom-mathquill-config-opt-noPercentOf-name = % of を無効化
custom-mathquill-config-opt-noPercentOf-desc = % と入力すると代わりに % of が入力される機能を無効にします。
custom-mathquill-config-opt-commaDelimiter-name = 数値のカンマ区切り
custom-mathquill-config-opt-commaDelimiter-desc = 数値の区切り文字としてカンマを挿入します。
custom-mathquill-config-opt-delimiterOverride-name = カスタム区切り文字
custom-mathquill-config-opt-delimiterOverride-desc = 数値の区切り文字として使用する文字列を設定します。
custom-mathquill-config-opt-leftIntoSubscript-name = 左右移動を下付き文字に
custom-mathquill-config-opt-leftIntoSubscript-desc = カーソルを左右に動かしたとき、上付き文字ではなく下付き文字にカーソルを移動させます。
custom-mathquill-config-opt-extendedGreek-name = ギリシャ文字の拡張
custom-mathquill-config-opt-extendedGreek-desc = サポートされているすべてのギリシャ文字の挿入を有効にします。
custom-mathquill-config-opt-lessFSpacing-name = f の周りのスペースを削減
custom-mathquill-config-opt-lessFSpacing-desc = 文字 f の周りの余分なスペースを削減します。

## Code Golf
code-golf-name = 数式ゴルフ
code-golf-desc = Desmos の数式ゴルファーのための補助ツール
code-golf-width-in-pixels = 幅: { $pixels } px
code-golf-symbol-count = 文字数: { $elements }
code-golf-click-to-enable-folder = クリックするとゴルフの統計を有効化できます。
code-golf-note-latex-byte-count = LaTeX 表現のバイト数 { $chars }

## Syntax highlightAlternatingLines
syntax-highlighting-name = シンタックスハイライト
syntax-highlighting-desc = 数式のさまざまな部分に色をつけて判読性を高めます。
syntax-highlighting-opt-bracketPairColorization-name = 括弧の色付け
syntax-highlighting-opt-bracketPairColorization-desc = 括弧に交互に色を適用し（例: ()[]{"{"}{"}"}||）、一致する括弧のペアを見つけやすくします。
syntax-highlighting-opt-bracketPairColorizationColors-name = 括弧の色
syntax-highlighting-opt-bracketPairColorizationColors-desc = 括弧の色付けに使用する色の数と順序を設定します。
syntax-highlighting-opt-bpcColorInText-name = 括弧内のテキストを色付けする
syntax-highlighting-opt-bpcColorInText-desc = 括弧内のテキストに括弧の色を適用します。
syntax-highlighting-opt-thickenBrackets-name = 括弧を太くする
syntax-highlighting-opt-thickenBrackets-desc = 括弧を太くし、色付けを補助します。
syntax-highlighting-opt-highlightBracketBlocks-name = 括弧のブロックをハイライト
syntax-highlighting-opt-highlightBracketBlocks-desc = テキストカーソルを含む最小の括弧のペアをハイライトします。
syntax-highlighting-opt-highlightBracketBlocksHover-name = ホバー時のハイライト
syntax-highlighting-opt-highlightBracketBlocksHover-desc = マウスを含む最小の括弧のペアをハイライトします。
syntax-highlighting-opt-underlineHighlightedRanges-name = ハイライト範囲に下線を引く
syntax-highlighting-opt-underlineHighlightedRanges-desc = ハイライトされた範囲の下に濃い下線を引いて見やすくします。

## Better Navigation
better-navigation-name = ナビゲーションの改善
better-navigation-desc = Desmos の数式での移動をより簡単にするためのツール
better-navigation-opt-ctrlArrow-name = Ctrl+Arrow のサポート
better-navigation-opt-ctrlArrow-desc = Ctrl+矢印キー または Ctrl+Shift+矢印キー を使用して、大きなテキストブロックをすばやくスキップします。Ctrl+Backspace を使用すると、大きなテキストブロックを削除できます。
better-navigation-opt-scrollableExpressions-name = 数式のスクロールを有効化
better-navigation-opt-scrollableExpressions-desc = 数式に水平スクロールバーを追加します。これは主にモバイルでのスクロールを簡単にするためのものです。

## Paste Image
paste-image-name = 画像の貼り付け
paste-image-desc = 画像ファイルを貼り付けて一度にインポートできます。
paste-image-error-images-not-enabled = このグラフでは画像の挿入が有効になっていません。
paste-image-error-another-upload-in-progress = 進行中の他のアップロードが終了してから再試行してください。

## Quake Pro
quake-pro-name = Quake Pro
quake-pro-desc = 3D グラフ計算機の通常の制限を超えて視野角を広げられるようにします。
quake-pro-opt-magnification-name = ズーム係数
quake-pro-opt-magnification-desc = この値を掛け合わせて表示領域のズーム上限を上げる
