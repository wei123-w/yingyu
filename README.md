# English VS 英语对战课堂

English VS 是一款无需账号的本地英语课堂游戏平台。词库、练习成绩和常规设置保存在当前浏览器中，不需要服务器或数据库。

## 启动

### Windows 一键启动

双击 `start.bat`。脚本需要本机安装 Python 3，会打开 `http://127.0.0.1:8765` 并在命令窗口运行静态文件服务。关闭命令窗口会停止服务。

如果端口 8765 已被占用，请先关闭占用该端口的本地服务，再重新启动。

### 其他系统或手动启动

在项目目录中运行：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

然后使用现代浏览器访问 `http://127.0.0.1:8765`。网页使用 ES 模块，不建议直接以 `file://` 方式打开。

## 发布到公网（网页与 AI）

项目包含 Cloudflare Pages Functions，可以将静态网页和同源 AI 转发接口一起部署。推荐通过 Git 集成发布，因为 Pages 需要识别项目根目录中的 `functions/` 文件夹。

1. 在 GitHub 新建一个自己的仓库，将本项目文件上传到仓库根目录。不要把 API 密钥写进代码或提交到仓库。
2. 在 Cloudflare 控制台进入 **Workers 和 Pages → 创建应用 → Pages → 连接到 Git**，授权并选择刚创建的仓库。
3. 构建设置选择静态 HTML 项目：框架预设选“无”，构建命令填 `node build-pages.mjs`，构建输出目录填 `pages-dist`。此脚本只复制网页资源，Cloudflare 会从项目根目录加载 `functions/` 接口。保存并部署。
4. 部署完成后打开 Cloudflare 提供的 `pages.dev` 地址，在“系统设置 → AI 导入”填写服务商的 Chat Completions 接口、支持视觉输入的模型名称和自己的 API 密钥，点击“测试连接”。

云端转发路径为 `/api/ai/chat/completions`，只允许代码中列出的服务商域名，使用 HTTPS，并且不保存 API 密钥。可用服务商包括 Groq、Google Gemini、DeepSeek、通义千问、OpenRouter、硅基流动、Mistral、月之暗面、OpenAI 和 Together。密钥仍存放在当前浏览器本地设置中；在共用设备上使用后请点“清除设置”。公开网址的访问者使用各自的 API 密钥和服务商额度。公开给不特定用户前，建议在 Cloudflare 为该接口配置速率限制和用量监控。

发布不会把词库和成绩上传到云端：它们仍保存在每位用户自己的浏览器中，不同设备之间不会自动同步。在线网页的英语发音使用浏览器和操作系统提供的语音；本机 Windows 女声服务仅在通过 `start.bat` 启动时可用。在线版没有登录、云端数据备份或多人实时联机功能。

Cloudflare Pages 的静态网页和 Functions 可在同一项目中发布，Pages Functions 会处理 `functions/` 目录对应的接口路由。仪表板直接拖拽上传不支持 Functions，请用 Git 集成或 Wrangler 发布。详细配置见 [Cloudflare Pages 静态 HTML 发布说明](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) 和 [Pages Functions 入门](https://developers.cloudflare.com/pages/functions/get-started/)。

## 功能

- 首页仪表盘：快速导入、词库概况、游戏入口、学习记录和每日词汇卡。
- 词库管理：新建与删除词库；单词增删改、搜索、分类、分页、朗读和 JSON 导出。
- 文件导入：TXT、CSV、TSV、JSON、DOCX 和可提取文本的 PDF。支持预览、重复检查、覆盖/跳过和选择目标词库。
- 游戏中心：单词选择、听力选择、拼写挑战和记忆配对；可配置词库、题数和时间，支持键盘作答、暂停、全屏和成绩记录。
- 排行榜：内置原型演示榜单，并单独展示当前设备真实练习数据。
- 学习记录：按玩法、时间和关键词筛选；可导出或清空。
- 系统设置：浅色、深色和薄荷绿主题；语音偏好；JSON 全量备份与恢复。
- 图片 AI 识别：可选配置兼容 Chat Completions 的视觉模型接口。识别结果进入审核预览，不会直接写入词库。

## 导入格式

CSV/TSV 可以用字段标题，例如：`word,phonetic,part,meaning,example,deck`。可识别 `word/英文/单词`、`meaning/中文/释义`、`phonetic/音标`、`part/词性`、`example/例句` 和 `deck/词库/分类`。

TXT 每行填写一个单词，可使用逗号、制表符、短横线或冒号分隔中文释义，例如：

```text
beautiful,美丽的,/ˈbjuːtɪfəl/,adj.,She is a beautiful girl.
abandon - 放弃；遗弃
ability：能力；才能
```

JSON 支持单词对象数组或 English VS 完整备份。完整备份可从“系统设置 → 数据管理”恢复。

DOCX 与 PDF 通过项目内附带的解析器在本机提取文字。扫描版 PDF 只有图片而没有文字层，无法由 PDF 文本提取器读取；可配置 AI 图片识别，或先使用 OCR 软件转成文本。

## 本地、浏览器与联网能力

| 能力 | 运行方式 |
| --- | --- |
| 词库、游戏、成绩、主题、JSON 备份 | 浏览器本地存储，不需要网络 |
| DOCX、PDF 文本提取 | 随项目提供的本地 JavaScript 解析器 |
| 英语发音 | 浏览器 Web Speech API 与操作系统语音；具体声音由设备提供 |
| 全屏展示 | 浏览器全屏 API，通常需由用户点击触发 |
| 图片识别 | 本机启动时经 Python 转发；Cloudflare Pages 发布时经同源 Functions 转发。均需用户配置兼容视觉模型的接口、模型、API 密钥和互联网 |
| 扫描版 PDF OCR | 需要上述 AI 图片识别或其他 OCR 工具 |
| 多人实时对战、聊天、跨设备同步 | 当前版本不包含服务端；对战页面明确作为本机课堂演示和个人练习使用 |

配置 AI 时请使用自己信任的服务。图片或扫描 PDF 的页面图像会发送至所填接口；本机版本经本机 Python 转发，云端版本经项目中的 Pages Function 转发。API 密钥保存在当前浏览器的本地设置中，浏览器本地存储不加密；不要在共用设备保存密钥。完整备份会排除 API 密钥，恢复时会保留当前浏览器已有的密钥。AI 输出可能有误，导入预览需由教师审核。

若浏览器不支持 IndexedDB，应用会尝试使用 localStorage 保存词库，适合较小数据量。定期导出完整 JSON 备份，避免清理浏览器数据后丢失内容。

## 项目结构

- `index.html`：应用框架。
- `build-pages.mjs`：生成仅包含网页资源的 Cloudflare Pages 发布目录。
- `styles.css`：视觉、响应式布局和主题。
- `src/main.js`：导航、视图和交互流程。
- `functions/api/ai/chat/completions.js`：Cloudflare Pages 同源 AI 转发接口。
- `src/data.js`：示例词库和游戏模式。
- `src/storage.js`：本地数据库与备份。
- `src/words.js`：词库与导入视图。
- `src/import.js`：文本、表格、JSON、DOCX、PDF 和可选 AI 图片解析。
- `src/games.js`：游戏逻辑、成绩、排行榜和记录。
- `src/ui.js`：对话框、提示、发音、全屏和格式化工具。
- `vendor/`：Mammoth.js 与 PDF.js 本地解析器及许可证。

完整提示词文件在视觉规范处截断于“明亮”。当前实现按可读取的需求和所附原型完成首版范围。

完整 JSON 备份会排除 AI API 密钥；恢复备份时保留当前浏览器中已有的密钥。
