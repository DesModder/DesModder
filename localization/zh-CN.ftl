# File Conventions:
# Everything related to a plugin starts with the ID of the plugin
# Hardcoded in the Typescript:
# [pluginID]-name = Name
# [pluginID]-desc = Description
# [pluginID]-opt-[optionKey]-name = Option Name
# [pluginID]-opt-[optionKey]-desc = Option Description

## General
menu-learn-more = 了解更多
menu-desmodder-plugins = DesModder 插件列表
menu-desmodder-tooltip = DesModder 菜单

## Category names
category-core-name = 核心功能
category-utility-name = 小工具
category-visual-name = 界面设置
category-integrations-name = 对外集成

## GLesmos
GLesmos-name = GLesmos
GLesmos-desc = 使用GPU渲染隐函数等图象。刷新页面后此功能将自动关闭。极少数情况下此功能可能会导致界面卡顿或卡死; 若出现问题请刷新网页重试。
GLesmos-label-toggle-glesmos = 使用 GLesmos 渲染
GLesmos-confirm-lines = 确认开启？
GLesmos-confirm-lines-body = 使用 GLesmos 渲染线条可能会很慢。请谨慎使用，尤其是在使用列表绘制一系列图象的时候。
# Missing: error messages

## Tips
show-tips-name = 显示小贴士
show-tips-desc = 在表达式列表的底部显示小贴士
# Missing: all tips. Is it worthwhile?

## Text Mode
text-mode-name = 文本模式（测试版）
text-mode-desc = 可能会出现故障。临时的使用文档请参见：
text-mode-toggle = 启用文本模式
# Missing: error messages

## Find and Replace
find-and-replace-name = 查找与替换
find-and-replace-desc = 在搜索栏(Ctrl+F)中添加“全部替换”按钮，方便批量重命名函数和变量。
find-and-replace-replace-all = 全部替换

## Wolfram To Desmos
wolfram2desmos-name = Wolfram 转 Desmos
wolfram2desmos-desc = 允许你将 ASCII Math 表达式（如从 Wolfram Alpha 中查询到的结果）粘贴到 Desmos 里。
wolfram2desmos-opt-reciprocalExponents2Surds-name = 根号表达式
wolfram2desmos-opt-reciprocalExponents2Surds-desc = 将小于1的分数指数幂转换为对应的根号表达式。
wolfram2desmos-opt-derivativeLoopLimit-name = 展开多阶导数
wolfram2desmos-opt-derivativeLoopLimit-desc = 将莱布尼茨符号下的n阶导数展开为n层嵌套的导数（最多10阶）。

## Pin Expressions
pin-expressions-name = 置顶表达式
pin-expressions-desc = 将某一条表达式置顶固定显示。
pin-expressions-pin = 置顶
pin-expressions-unpin = 取消置顶

## Builtin Settings
builtin-settings-name = 图形计算器设置
builtin-settings-desc = 启用一些Desmos的隐藏内置功能。大多数选项只会对你自己的浏览器起作用，在向他人分享图表时这些设置不会生效。
builtin-settings-opt-advancedStyling-name = 高级样式
builtin-settings-opt-advancedStyling-desc = 可编辑标签、悬浮时显示、文本轮廓、以及仅绘制第一象限网格等功能
builtin-settings-opt-graphpaper-name = 绘图区
builtin-settings-opt-graphpaper-desc = {""}
builtin-settings-opt-authorFeatures-name = 创作者功能
builtin-settings-opt-authorFeatures-desc = 隐藏文件夹、只读模式等功能
builtin-settings-opt-pointsOfInterest-name = 显示关键点
builtin-settings-opt-pointsOfInterest-desc = 截点、洞、交点等
builtin-settings-opt-trace-name = 沿曲线追踪
builtin-settings-opt-trace-desc = {""}
builtin-settings-opt-expressions-name = 显示表达式列表
builtin-settings-opt-expressions-desc = {""}
builtin-settings-opt-zoomButtons-name = 显示缩放按钮
builtin-settings-opt-zoomButtons-desc = {""}
builtin-settings-opt-keypad-name = 显示虚拟键盘
builtin-settings-opt-keypad-desc = {""}

## Duplicate Expression Hotkey
duplicate-expression-hotkey-name = 单行复制快捷键
duplicate-expression-hotkey-desc = 按 Ctrl+Q 或 Ctrl+Shift+Q 快速复制当前光标所在行

## Right Click Tray
right-click-tray-name = 右键打开托盘
right-click-tray-desc = 除了长按表达式左侧圆形图标之外，也可以对其右键单击以打开设置托盘

## Set Primary Color
set-primary-color-name = 设置主色调
set-primary-color-desc = 自定义界面主色调
set-primary-color-opt-primaryColor-name = 主色调
set-primary-color-opt-primaryColor-desc = 整个图形计算器的主色调
set-primary-color-opt-doFavicon-name = 更新网站图标
set-primary-color-opt-doFavicon-desc = 选择是否同步更新 Desmos 网站图标的颜色

## Hide Errors
hide-errors-name = 隐藏错误提示
hide-errors-desc = 点击错误图标即可忽略错误，同时隐藏所有添加滑块的建议
hide-errors-hide = 隐藏建议

## Folder Tools
folder-tools-name = 文件夹工具
folder-tools-desc = 在列表编辑模式中添加按钮，帮助管理文件夹
folder-tools-dump = 拆解
folder-tools-merge = 并入
folder-tools-enclose = 合装

## Video Creator
video-creator-name = 视频创作器
video-creator-desc = 录制图象在动作执行或变量渐变时的动画，导出为视频或GIF
video-creator-menu = 视频创作器菜单
video-creator-to = 至
video-creator-step = , 步长为
video-creator-ticks-step = 时间步长 (ms):
video-creator-prev-action = 上一个
video-creator-next-action = 下一个
video-creator-size = 大小：
video-creator-step-count = 步数：
video-creator-target-same-pixel-ratio = 保持原有像素比率
video-creator-target-tooltip = 调整线宽, 点大小, 标签大小等的整体缩放。
video-creator-ffmpeg-loading = FFmpeg 加载中...
video-creator-ffmpeg-fail = 如果在数秒后仍无法完成加载，请刷新页面，或将此故障反馈给 DesModder 开发者。
video-creator-exporting = 导出中...
video-creator-cancel-capture = 取消
video-creator-cancel-export = 取消
video-creator-capture = 拍摄
video-creator-preview = 预览
video-creator-delete-all = 删除全部
video-creator-filename-placeholder = 设置文件名称
video-creator-export = 导出
video-creator-export-as = 导出为 { $fileType }
video-creator-fps = FPS:
video-creator-method-once = 单帧截图
video-creator-method-slider = 变量动画
video-creator-method-action = 动作动画
video-creator-method-ticks = 定时器动画

## Wakatime
wakatime-name = WakaTime
wakatime-desc = 在 WakaTime.com 中记录你的 Desmos 使用活动
wakatime-opt-secretKey-name = 密钥
wakatime-opt-secretKey-desc = WakaTime 服务器使用的API密钥
wakatime-opt-splitProjects-name = 按图表划分项目
wakatime-opt-splitProjects-desc = 将每张图表记录为单独的项目，而非作为一个统一 Desmos 项目下的不同分支
wakatime-opt-projectName-name = 项目名称
wakatime-opt-projectName-desc = 此名称在 WakaTime 中可见，并且为所有 Desmos 所项目共享

## Performance Display
performance-info-name = 性能信息
performance-info-desc = 显示当前图表的运行性能信息。
performance-info-refresh-graph = 刷新图表
performance-info-refresh-graph-tooltip = 刷新当前图表，以测试图表的载入时间
performance-info-sticky-tooltip = 保持此菜单显示
performance-info-time-in-worker = 总处理用时
performance-info-compiling = 编译用时
performance-info-rendering = 渲染用时
performance-info-other = 其它用时

## Better Evaluation View
better-evaluation-view-name = 显示详细结果
better-evaluation-view-desc = 显示列表中的元素，颜色的rgb表示，以及undefined量的具体值
better-evaluation-view-opt-lists-name = 详细显示列表
better-evaluation-view-opt-lists-desc = 展示列表中的各项元素，而非只显示列表的长度
better-evaluation-view-opt-colors-name = 详细显示颜色
better-evaluation-view-opt-colors-desc = 显示颜色的rgb值
better-evaluation-view-opt-colorLists-name = 详细显示颜色列表
better-evaluation-view-opt-colorLists-desc = 显示颜色列表对应的rgb值列表
