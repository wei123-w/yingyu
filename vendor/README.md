# 随项目提供的本地解析器

- `mammoth/mammoth.browser.min.js`：Mammoth.js 1.13.0，用于在浏览器本机提取 DOCX 文本；许可证见同目录 `LICENSE`。
- `pdfjs/pdf.min.mjs` 与 `pdfjs/pdf.worker.min.mjs`：Mozilla PDF.js 6.3.289，用于在浏览器本机提取 PDF 文本；许可证见同目录 `LICENSE`。

文件来自 Mammoth.js 与 Mozilla PDF.js 的 npm 发布包，通过 jsDelivr 获取后随项目本地提供。核心词库和游戏不访问第三方服务。扫描版 PDF 没有可提取文字时，需要配置联网视觉模型进行 OCR。
