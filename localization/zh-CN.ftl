# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Hardcoded in the Typescript:
# [pluginID]-name = Name
# [pluginID]-desc = Description
# [pluginID]-opt-[optionKey]-name = Option Name
# [pluginID]-opt-[optionKey]-desc = Option Description

## General
menu-learn-more = 了解更多
menu-desmodder-plugins = DesModder 插件
menu-desmodder-tooltip = DesModder 菜单

## Category names
category-core-name = 核心功能
category-utility-name = 工具
category-visual-name = 视觉
category-integrations-name = 集成

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = 使用 GPU 渲染隐式图形。在极少数情况下可能导致界面卡顿或无响应；如遇问题请刷新页面。
GLesmos-label-toggle-glesmos = 使用 GLesmos 渲染
GLesmos-confirm-lines = 确认渲染
GLesmos-confirm-lines-body = GLesmos 渲染线条可能会很慢。请谨慎操作，尤其是使用列表绘制一系列图层时。
GLesmos-no-support = 很抱歉，您的浏览器不支持 GLesmos，因为不支持 WebGL2。
GLesmos-not-enabled = 启用 GLesmos 插件可提升部分隐式图形的性能。
# Missing: error messages

## Tips
show-tips-name = 显示 tips
show-tips-desc = 在表达式列表底部显示各类提示
show-tips-tip-export-videos = 导出视频时，建议优先选择 MP4 或 APNG 格式，避免使用 GIF
show-tips-tip-disable-graphpaper = 关闭计算器设置中的绘图区，有助于连续输入多条方程
show-tips-tip-paste-asciimath = 可直接将 ASCII Math 粘贴到 Desmos
show-tips-tip-pin = 可将常用表达式置顶（"书签"），便于快速访问
show-tips-tip-long-video-capture = 进行长时间录制前，建议先从开头片段测试一下
show-tips-tip-find-replace = "查找与替换"功能很适合用于批量重命名变量或函数
show-tips-tip-duplicate = 按 Ctrl+Q 或 Ctrl+Shift+Q 可复制当前表达式
show-tips-tip-note-newline = 在注释与文件夹标题中按 Shift+Enter 可换行
show-tips-tip-hide-errors = 点击黄色警告符号（或按 Shift+Enter）可淡化警告并隐藏滑块创建建议
show-tips-tip-note-folder = 输入 " （英文双引号）可快速新建注释；输入 "folder" 可新建文件夹
show-tips-tip-arctan = 使用 arctan(y, x) 而不是 arctan(y / x) 获取点的角度
show-tips-tip-indefinite-integral = 积分可以使用无穷作为上下限
show-tips-tip-random = random 函数可以从分布中采样
show-tips-tip-two-argument-round = round 的双参数形式很适合对标签进行四舍五入
show-tips-tip-two-argument-sort = sort(A, B) 可依据一个列表对另一个列表排序
show-tips-tip-custom-colors = 使用 rgb 和 hsv 函数自定义颜色
show-tips-tip-ctrl-f = 按 Ctrl+F 可搜索表达式
show-tips-tip-derivatives = 可用撇号或莱布尼茨记号求导
show-tips-tip-unbounded-list-slices = 列表切片不必有界
show-tips-tip-dataviz-plots = 可用直方图(histogram)、箱线图(boxplot)等方式可视化数据
show-tips-tip-statistics = Desmos 内置多种统计函数
show-tips-tip-table-draggable-points = 使用表格可以批量创建可拖动的点
show-tips-tip-polygon = polygon 函数可便捷绘制多边形
show-tips-tip-point-arithmetic = 点（向量）运算如 (1, 2) + (3, 4) = (4, 6)
show-tips-tip-shift-drag = 按住 Shift 拖动坐标轴可单独缩放该轴
show-tips-tip-action-ticker = 使用 action 和 ticker 可进行模拟运算
show-tips-tip-latex-copy-paste = 可将 Desmos 的数学内容直接粘贴到 LaTeX 编辑器
show-tips-tip-time-in-worker = 想测试图表运行速度，可用 ?timeInWorker 或开启性能显示插件
show-tips-tip-format-labels = 用反引号可让点标签以数学格式显示
show-tips-tip-dynamic-labels = 用 ${"{"} {"}"} 可设置动态显示变量的点标签
show-tips-tip-disable-text-outline = 关闭文本轮廓有时能提升标签可读性
show-tips-tip-regression-power = 回归分析比你想象的更强大
show-tips-tip-spreadsheet-table = 粘贴外部表格数据可快速创建 Desmos 表格
show-tips-tip-keyboard-shortcuts = 按 Ctrl+/ 或 Cmd+/ 可查看快捷键列表
show-tips-tip-listcomps = 列表推导式适合批量生成网格点列表或多边形列表
show-tips-tip-list-filters = 列表过滤式可用于筛选列表中的正数、偶数等
show-tips-tip-bernard = Bernard
show-tips-tip-new-desmos = 了解 Desmos 新动态
show-tips-tip-simultaneous-actions = 动作赋值是同时进行的，而非顺序执行
show-tips-tip-share-permalink = 可通过永久链接分享图表，无需登录
show-tips-tip-point-coordinate = 在点变量后使用 .x 或 .y 可提取坐标分量
show-tips-tip-audiotrace = 使用音频跟踪功能可以"听"你的图表！
show-tips-tip-audiotrace-note-frequency = 音频跟踪的音高取决于其在视口中的位置
show-tips-tip-audiotrace-range = 音频跟踪的音高范围为 E4（329.63 Hz）到 E5（659.25 Hz）
show-tips-tip-other-calculators = Desmos 还有其他计算器！
show-tips-tip-lock-viewport = 不想让视口被移动？可在图表设置中锁定！
show-tips-tip-glesmos = 启用 GLesmos 插件可加速部分隐式图形的渲染
show-tips-tip-disable-show-tips = 不想再看到 tips？可在设置中关闭"显示 tips"插件
show-tips-tip-compact-view-multiline = 表达式面板太长？试试开启"紧凑视图"或"多行表达式"
show-tips-tip-intellisense = 变量名太长？启用"Intellisense"让操作更便捷
show-tips-tip-youre-doing-great = 你做得很棒 :)
show-tips-tip-youre-superb = 你超棒 <3
show-tips-tip-huggy = 抱抱！

## Text Mode
text-mode-name = 文本模式（测试版）
text-mode-desc = 可能存在 bug。临时文档：
text-mode-toggle = 切换文本模式
text-mode-toggle-spaces = 空格
text-mode-toggle-spaces-tooltip = 格式化时保留多余空格
text-mode-toggle-newlines = 换行
text-mode-toggle-newlines-tooltip = 格式化时保留换行和缩进
text-mode-format = 格式化

## Find and Replace
find-and-replace-name = 查找与替换
find-and-replace-desc = 在 Ctrl+F 菜单中新增一个"全部替换"按钮，方便批量重命名变量或函数。
find-and-replace-replace-all = 全部替换

## Wolfram To Desmos
wolfram2desmos-name = Wolfram 转 Desmos
wolfram2desmos-desc = 允许你将 ASCII Math（如 Wolfram Alpha 查询结果）粘贴到 Desmos。
wolfram2desmos-opt-reciprocalExponents2Surds-name = 根号记法
wolfram2desmos-opt-reciprocalExponents2Surds-desc = 将小于 1 的分数指数幂转换为根号表达式
wolfram2desmos-opt-derivativeLoopLimit-name = 展开多阶导数
wolfram2desmos-opt-derivativeLoopLimit-desc = 将莱布尼茨符号下的 n 阶导数展开为多层嵌套（最多 10 层）。

## Pin Expressions
pin-expressions-name = 置顶表达式
pin-expressions-desc = 可在编辑列表模式下将表达式置顶显示
pin-expressions-pin = 置顶
pin-expressions-unpin = 取消置顶

## Builtin Settings
builtin-settings-name = 计算器设置
builtin-settings-desc = 可开启或关闭 Desmos 的内置功能。大多数选项仅对本地浏览器生效，分享图表时不会影响他人。
builtin-settings-opt-advancedStyling-name = 高级样式
builtin-settings-opt-advancedStyling-desc = 启用标签编辑、悬停显示、文本轮廓和单象限网格等功能
builtin-settings-opt-graphpaper-name = 绘图区
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = 创作者功能
builtin-settings-opt-authorFeatures-desc = 开启隐藏文件夹、只读模式等功能
builtin-settings-opt-pointsOfInterest-name = 显示关键点
builtin-settings-opt-pointsOfInterest-desc = 截点、空点、交点等
builtin-settings-opt-trace-name = 沿曲线追踪
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = 显示表达式列表
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = 显示缩放按钮
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-keypad-name = 显示虚拟键盘
builtin-settings-opt-keypad-desc = {""}
builtin-settings-opt-showPerformanceMeter-name = 显示性能计
builtin-settings-opt-showPerformanceMeter-desc = {""}
builtin-settings-opt-showIDs-name = 显示 ID
builtin-settings-opt-showIDs-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = 复制表达式快捷键
duplicate-expression-hotkey-desc = 按 Ctrl+Q 或 Ctrl+Shift+Q 可复制当前选中的表达式。

## Right Click Tray
right-click-tray-name = 右键托盘
right-click-tray-desc = 可通过右键点击设置圆点打开托盘，无需长按

## Set Primary Color
set-primary-color-name = 设置主色调
set-primary-color-desc = 选择 UI 主色调
set-primary-color-opt-primaryColor-name = 主色调
set-primary-color-opt-primaryColor-desc = 计算器的全局主色调
set-primary-color-opt-doFavicon-name = 更新网站图标
set-primary-color-opt-doFavicon-desc = 是否更新网站图标的颜色

## Hide Errors
hide-errors-name = 隐藏错误提示
hide-errors-desc = 按住 Shift 点击错误三角图标可淡化警告并隐藏滑块建议
hide-errors-hide = 隐藏

## Folder Tools
folder-tools-name = 文件夹工具
folder-tools-desc = 在编辑列表模式下新增一些按钮，便于管理文件夹
folder-tools-dump = 拆分
folder-tools-merge = 合并
folder-tools-enclose = 封装

## Video Creator
video-creator-name = 视频创作器
video-creator-desc = 录制动作执行或滑块变化的图表动画，导出为视频或 GIF
video-creator-menu = 视频创作器菜单
video-creator-to = 至
video-creator-step = ，步长为
video-creator-ticks-playing-sliders = 正在播放的滑块：
video-creator-ticks-step = 时间步长（毫秒）：
video-creator-prev-action = 上一个
video-creator-next-action = 下一个
video-creator-orientation = 方向
video-creator-orientation-mode-current-speed = 速率
video-creator-orientation-mode-current-delta = 步进
video-creator-orientation-mode-from-to = 起止
video-creator-size = 大小：
video-creator-mosaic = 拼图：
video-creator-angle-current = 角度：
video-creator-angle-from = 自：
video-creator-angle-to = 至：
video-creator-angle-step = 步长：
video-creator-angle-speed = 速度：
video-creator-step-count = 步数：
video-creator-frame-count = 帧数：
video-creator-target-same-pixel-ratio = 保持像素比
video-creator-fast-screenshot = 快速截图
video-creator-target-tooltip = 调整线宽、点大小、标签大小等整体缩放
video-creator-ffmpeg-loading = FFmpeg 加载中……
video-creator-ffmpeg-fail = 若长时间无响应，请刷新页面或反馈给开发者
video-creator-exporting = 导出中……
video-creator-cancel-capture = 取消拍摄
video-creator-cancel-export = 取消导出
video-creator-capture = 拍摄
video-creator-preview = 预览
video-creator-delete-all = 删除全部
video-creator-filename-placeholder = 请设置文件名
video-creator-export = 导出
video-creator-export-as = 导出为 { $fileType }
video-creator-fps = 帧率：
video-creator-method-once = 单帧
video-creator-method-ntimes = 多帧
video-creator-method-slider = 滑块
video-creator-method-action = 动作
video-creator-method-ticks = 定时器

## Wakatime
wakatime-name = WakaTime
wakatime-desc = 在 WakaTime.com 记录你的 Desmos 活动
wakatime-opt-secretKey-name = 密钥
wakatime-opt-secretKey-desc = 用于 WakaTime 服务器的 API 密钥
wakatime-opt-splitProjects-name = 按图表分项目
wakatime-opt-splitProjects-desc = 每个图表单独作为一个项目记录
wakatime-opt-projectName-name = 项目名称
wakatime-opt-projectName-desc = 在 WakaTime 可见，所有 Desmos 项目共享

## Performance Display
performance-info-name = 性能显示
performance-info-desc = 显示当前图表的性能信息
performance-info-refresh-graph = 刷新图表
performance-info-refresh-graph-tooltip = 刷新以测试初始加载时间
performance-info-sticky-tooltip = 保持菜单显示
performance-info-time-in-worker = Worker 用时
performance-info-compiling = 编译
performance-info-rendering = 渲染
performance-info-other = 其他用时

## Better Evaluation View
better-evaluation-view-name = 详细结果显示
better-evaluation-view-desc = 显示列表元素、颜色和 undefined 的具体值
better-evaluation-view-opt-floats-name = 高级浮点显示
better-evaluation-view-opt-floats-desc = 用 NaN/∞/-∞ 替代 undefined，负零显示为"-0"
better-evaluation-view-opt-lists-name = 显示列表元素
better-evaluation-view-opt-lists-desc = 展示列表中的各项元素而非仅显示列表长度
better-evaluation-view-opt-colors-name = 显示颜色
better-evaluation-view-opt-colors-desc = 以 rgb 形式显示颜色
better-evaluation-view-opt-colorLists-name = 显示颜色列表
better-evaluation-view-opt-colorLists-desc = 以 rgb 列表显示颜色列表

## Pillbox Menus
pillbox-menus-name = 右侧按钮（核心）
pillbox-menus-desc = 在界面右侧显示按钮，如视频创作器或 DesModder 主菜单

## Manage Metadata
manage-metadata-name = 元数据管理（核心）
manage-metadata-desc = 管理元数据，如 GLesmos 或置顶状态

## Intellisense
intellisense-name = Intellisense
intellisense-desc = 为 Desmos 带来自动补全、函数参数提示、跳转定义等常见 IDE 功能。文档见：
intellisense-opt-subscriptify-name = 自动下标
intellisense-opt-subscriptify-desc = 自动将带下标的变量/函数名在输入时转为下标格式
intellisense-jump2def-menu-instructions = 有多个定义。请选择一个跳转。

## Compact View
compact-view-name = 紧凑视图
compact-view-desc = 提供多种界面压缩选项，让你能在屏幕上看到更多内容。
compact-view-opt-textFontSize-name = 注释字体大小
compact-view-opt-textFontSize-desc = 注释文本的字体大小
compact-view-opt-mathFontSize-name = 数学字体大小
compact-view-opt-mathFontSize-desc = 数学表达式的字体大小
compact-view-opt-bracketFontSizeFactor-name = 括号缩放因子
compact-view-opt-bracketFontSizeFactor-desc = 括号内文本的字体缩小比例
compact-view-opt-minimumFontSize-name = 最小字体
compact-view-opt-minimumFontSize-desc = 数学字体的最小值（覆盖括号缩放）
compact-view-opt-compactFactor-name = 去除间距
compact-view-opt-compactFactor-desc = 去除表达式列表中的多余空白
compact-view-opt-hideFolderToggles-name = 隐藏文件夹开关
compact-view-opt-hideFolderToggles-desc = 隐藏用于折叠/置顶文件夹的按钮
compact-view-opt-noSeparatingLines-name = 无分隔线
compact-view-opt-noSeparatingLines-desc = 去除表达式间分隔线，改用交替背景色
compact-view-opt-highlightAlternatingLines-name = 高亮交替行
compact-view-opt-highlightAlternatingLines-desc = 用交替背景色高亮表达式，便于区分
compact-view-opt-hideEvaluations-name = 折叠结果
compact-view-opt-hideEvaluations-desc = 结果显示在侧边，仅在聚焦或悬停时显示

## Multiline
multiline-name = 多行表达式
multiline-desc = 将表达式自动换行，更好利用空间
multiline-opt-widthBeforeMultiline-name = 换行宽度阈值（%）
multiline-opt-widthBeforeMultiline-desc = 触发换行的最小宽度（占视口百分比），移动端为 3 倍
multiline-opt-automaticallyMultilinify-name = 输入时自动换行
multiline-opt-automaticallyMultilinify-desc = 输入时自动换行，无需手动 Ctrl+M
multiline-opt-multilinifyDelayAfterEdit-name = 编辑延迟（毫秒）
multiline-opt-multilinifyDelayAfterEdit-desc = 编辑后静止多少毫秒自动分行
multiline-opt-spacesToNewlines-name = 空格转换为换行
multiline-opt-spacesToNewlines-desc = 三个空格自动转为换行（可用 Shift+Enter 快速输入）
multiline-opt-determineLineBreaksAutomatically-name = 自动插入换行
multiline-opt-determineLineBreaksAutomatically-desc = 自动判断换行位置，Ctrl+M 触发
multiline-opt-disableAutomaticLineBreaksForHandAlignedExpressions-name = 跳过手动对齐表达式
multiline-opt-disableAutomaticLineBreaksForHandAlignedExpressions-desc = 有手动换行（3 空格）的表达式不再自动换行

## Custom MathQuill Config
custom-mathquill-config-name = 自定义 MathQuill 配置
custom-mathquill-config-desc = 更改公式输入方式
custom-mathquill-config-opt-superscriptOperators-name = 指数中的运算符
custom-mathquill-config-opt-superscriptOperators-desc = 允许在指数中输入如"+"等运算符
custom-mathquill-config-opt-noAutoSubscript-name = 禁用自动下标
custom-mathquill-config-opt-noAutoSubscript-desc = 禁止变量名后输入数字自动变为下标
custom-mathquill-config-opt-noNEquals-name = 禁用 n= 求和符号
custom-mathquill-config-opt-noNEquals-desc = 禁止求和符号自动在下标处插入"n="
custom-mathquill-config-opt-subSupWithoutOp-name = 无操作数下标/上标
custom-mathquill-config-opt-subSupWithoutOp-desc = 允许无前置内容时输入下标或上标
custom-mathquill-config-opt-allowMixedBrackets-name = 允许不匹配的括号
custom-mathquill-config-opt-allowMixedBrackets-desc = 允许所有括号互相匹配（包括绝对值）
custom-mathquill-config-opt-subscriptReplacements-name = 下标替换
custom-mathquill-config-opt-subscriptReplacements-desc = 允许在下标中输入符号和函数名
custom-mathquill-config-opt-noPercentOf-name = 禁用"% of"
custom-mathquill-config-opt-noPercentOf-desc = 输入"%"时直接插入百分号，而不是"% of"
custom-mathquill-config-opt-commaDelimiter-name = 千分位分隔符
custom-mathquill-config-opt-commaDelimiter-desc = 在数字中插入逗号分隔符（仅视觉效果）
custom-mathquill-config-opt-delimiterOverride-name = 自定义分隔符
custom-mathquill-config-opt-delimiterOverride-desc = 设置数字分隔符字符串
custom-mathquill-config-opt-leftIntoSubscript-name = 左右键进入下标
custom-mathquill-config-opt-leftIntoSubscript-desc = 用左右键可进入下标而非上标
custom-mathquill-config-opt-extendedGreek-name = 更多希腊字母
custom-mathquill-config-opt-extendedGreek-desc = 启用所有支持的希腊字母替换
custom-mathquill-config-opt-lessFSpacing-name = 减少"f"周围间距
custom-mathquill-config-opt-lessFSpacing-desc = 减少字母"f"两侧的额外间距

## Code Golf
code-golf-name = Code Golf
code-golf-desc = 为 Desmos Code Golf 爱好者提供工具
code-golf-width-in-pixels = 宽度：{ $pixels } px
code-golf-symbol-count = 符号数：{ $elements }
code-golf-click-to-enable-folder = 点击启用 Code Golf 统计
code-golf-note-latex-byte-count = { $chars } LaTeX 字节

## Syntax Highlighting
syntax-highlighting-name = 语法高亮
syntax-highlighting-desc = 为表达式着色，便于理解
syntax-highlighting-opt-bracketPairColorization-name = 括号配对着色
syntax-highlighting-opt-bracketPairColorization-desc = 为括号（如 ()[]{"{"}{"}"}||）配对着色，便于识别
syntax-highlighting-opt-bracketPairColorizationColors-name = 括号配色方案
syntax-highlighting-opt-bracketPairColorizationColors-desc = 设置括号配对着色的颜色数量和顺序
syntax-highlighting-opt-bpcColorInText-name = 括号内文本着色
syntax-highlighting-opt-bpcColorInText-desc = 对括号内文本应用括号配色
syntax-highlighting-opt-thickenBrackets-name = 加粗括号
syntax-highlighting-opt-thickenBrackets-desc = 加粗括号以辅助配对着色
syntax-highlighting-opt-highlightBracketBlocks-name = 高亮括号块
syntax-highlighting-opt-highlightBracketBlocks-desc = 高亮光标所在的最小括号对
syntax-highlighting-opt-highlightBracketBlocksHover-name = 悬停高亮
syntax-highlighting-opt-highlightBracketBlocksHover-desc = 高亮鼠标悬停处的最小括号对
syntax-highlighting-opt-underlineHighlightedRanges-name = 下划线高亮范围
syntax-highlighting-opt-underlineHighlightedRanges-desc = 为高亮范围添加深色下划线以增强可见性

## Better Navigation
better-navigation-name = 更好的导航
better-navigation-desc = 让 Desmos 表达式更易于导航
better-navigation-opt-ctrlArrow-name = Ctrl+方向键 支持
better-navigation-opt-ctrlArrow-desc = 用 Ctrl+方向键或 Ctrl+Shift+方向键可快速跳过大段文本，Ctrl+Backspace 可快速删除
better-navigation-opt-scrollableExpressions-name = 表达式可滚动
better-navigation-opt-scrollableExpressions-desc = 为表达式添加横向滚动条，移动端更易操作
better-navigation-opt-showScrollbar-name = 显示滚动条
better-navigation-opt-showScrollbar-desc = 显示或隐藏滚动条，触屏设备建议关闭

## Paste Image
paste-image-name = 粘贴图片
paste-image-desc = 支持粘贴图片文件，一键导入
paste-image-error-images-not-enabled = 当前图表未启用插入图片功能
paste-image-error-another-upload-in-progress = 有其他上传任务进行中，请稍后重试
