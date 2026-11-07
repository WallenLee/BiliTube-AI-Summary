# 🚀 BiliTube-AI-Summary (视频AI思维导图与深度总结助手)

<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="BiliTube AI Summary Logo" />
</p>

<p align="center">
  <b>一键将 B站 (Bilibili) 与 YouTube 视频提炼为结构化总结与 Markmap 交互式思维导图</b><br>
  🎙️ 支持无字幕视频本地语音识别 (SenseVoice) · ⚡ 侧边栏无缝伴读 · 💬 伴读答疑与划词即问 · ⏱️ 点击时间戳原片同步跳转 · 💾 一键保存为 Markdown (.md) 文档（支持勾选问答）
</p>

<p align="center">
  <img src="https://img.shields.io/badge/无字幕视频-支持本地ASR转写-success?style=for-the-badge&logo=soundcharts&logoColor=white" alt="No Subtitle Supported">
  <img src="https://img.shields.io/badge/伴读答疑-划词即问_长上下文溯源-brightgreen?style=for-the-badge" alt="Interactive Q&A">
  <img src="https://img.shields.io/badge/本地离线ASR-SenseVoice_GPU加速-orange?style=for-the-badge" alt="Local ASR">
  <img src="https://img.shields.io/badge/Chrome_Extension-SidePanel_V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Edge_Extension-Supported-green?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Edge Extension">
  <img src="https://img.shields.io/badge/AI_Engine-Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini">
  <img src="https://img.shields.io/badge/License-MIT-purple.svg?style=for-the-badge" alt="License">
</p>

---

## 💡 为什么设计双通道总结机制？

在实际使用中，很多学习者会遇到以下情况：
- **大量长视频没有现成字幕**：B 站等平台许多视频不再默认提供官方或 AI 字幕，仅依赖在线字幕抓取的常规工具在遇到无字幕视频时通常会提示失败；
- **商业转写服务成本较高**：部分支持无字幕转写的商业软件通常按视频时长计费，且需要将音频全量上传至第三方云端服务器。

为此，**BiliTube-AI-Summary** 采用了**“有字幕直拉 + 无字幕本地离线转写”**的双通道设计：
- **有字幕时**：直接读取现成字幕，10~15 秒快速出图；
- **无字幕时**：通过本地 8 线程并发下载轻量音频流，调用本地离线语音模型（SenseVoice）完成转写后再进行总结，无需将音频上传给商业转写云服务，保护隐私且无时长扣费。

---

### 📋 方案特性对比

| 对比维度 | 常规纯在线字幕插件 / 脚本 | 商业云端转写软件 | **BiliTube-AI-Summary (本项目)** |
| :--- | :--- | :--- | :--- |
| **无字幕视频** | 提示无字幕，无法生成 | 需上传音频，按时长扣费 | ✅ **自动调用本地离线 ASR 模型转写后总结** |
| **音频下载方式** | 不支持下载 | 通常为单线程下载 | ✅ **8 线程分块并发 + 32k/64k 仅人声音频流** |
| **语音识别 (ASR)** | 无 | 依赖云端队列 | ✅ **本地离线 SenseVoice（支持 Vulkan/CUDA GPU 加速）** |
| **视频时间戳联动** | 部分支持 | 通常仅导出静态文本 | ✅ **导图 / 总结 / 字幕点击即可让原片同步跳转** |
| **交互思维导图** | 多数仅提供文字段落 | 通常不提供思维导图 | ✅ **Markmap 树状交互导图，支持缩放与深浅色切换** |
| **数据与隐私** | 需上传 Cookie 或依赖中转 | 音频上传第三方服务器 | ✅ **Local-First 架构，本地离线计算，无中心数据收集** |
| **使用成本** | 限制次数或引导充值 | 按时长收费 | ✅ **开源免费** |

---

## 🌟 核心功能与实现方式

### 1. 🎙️ 有字幕 / 无字幕双通道管道
- **快通道（有在线字幕时）**：
  扩展直接利用用户在浏览器当前的登录态，0.2 秒读取原画清晰度下的官方/AI 字幕，跳过音频下载直接由 Gemini 提炼，10~15 秒快速呈现结果。
- **慢通道（无字幕视频自动兜底）**：
  当视频未提供任何在线字幕时，后端自动启动本地处理流程：
  1. **音频流瘦身**：仅提取人声所需的 32k~64k 轻量音频流，大幅减少下载体积；
  2. **8 线程分块并发**：分段并发下载音频，提升下载效率；
  3. **SenseVoice 语音识别**：直接输入本地部署的 SenseVoice 离线模型（配合 FSMN-VAD 断句），利用显卡硬件加速（Vulkan / CUDA / DirectML）快速完成语音转文本与时间戳对齐。

### 2. 🧠 Markmap 高对比度交互导图
- 自动将长视频提炼为层次分明的思维导图；
- 节点带有微磨砂气泡卡片，保证文字高对比度不发灰；
- 支持深色 🌙 / 浅色 ☀️ 双主题一键切换，支持鼠标滚轮自由缩放和平移展开。

### 3. ⏱️ 视频时间戳全链路联动
- 在思维导图节点、完整总结正文或字幕列表中，点击任意时间戳胶囊（例如 `⏱️ 03:25`）；
- 扩展会自动向当前视频播放页发送进度跳转指令，原片秒级跳转至对应位置。

### 4. 🎯 结构清晰的总结内容
- **💡 一句话主旨**：概括原视频核心结论；
- **🎯 核心深度洞见**：
  - **背景与痛点**：梳理视频探讨的现实背景或矛盾；
  - **推演脉络与机制**：展现作者的推导逻辑，并将关键数据、事实案例自然融入分析中；
  - **术语解析**：按需输出，对涉及的专有名词分别给出“学术/行业定义”与“通俗白话解释”；
- **🧠 脉络思维导图**：时间线与逻辑融合的纯净大纲树。

### 5. 💬 伴读答疑与划词即问 (长上下文溯源)
- **划词即问（选中文本免翻页追问）**：在阅读「完整总结」时，划选任意词句，自动弹出悬浮操作条：
  - 💡 **通俗解释**：用大白话和生活比喻解释晦涩难懂的概念；
  - 🔍 **展开论据**：调取原视频中作者支撑此观点的实际数据、案例与论证细节；
  - 💬 **追问**：将选中内容一键带入对话框引用条，免去手动复制粘贴；
- **思维导图分支一键提问**：点击思维导图任意节点旁的 `💬` 图标，自动切换至答疑 Tab 并生成针对该分支的深度剖析；
- **全量长上下文保障**：提问时将视频元数据、完整结构化总结大纲与全量带时间戳字幕一并作为上下文交付 AI，拒绝断章取义；
- **回答时间戳全链路联动**：AI 在回答中引用的原片时间戳（如 `⏱️ 03:25`）同样支持点击跳转，帮助快速求证原片论述。

### 6. 💾 本地保存为标准 Markdown 文档
- 默认不强制保存，用户可在浏览满意后点击「保存这篇到本地」；
- **智能伴读问答勾选导出**：保存时弹出选项列表，支持自主勾选想要一并保留的 AI 深度问答对话，未勾选的不写入文档；
- 设置中支持弹出原生文件夹选择器，自由指定本地 Markdown 存储目录；
- 保存后可一键在系统默认编辑器（如 Typora、VS Code、Obsidian、Logseq 等）中直接打开查看。

---

## 🛠️ 环境依赖与准备

| 依赖项 | 作用 | 说明与获取方式 |
| :--- | :--- | :--- |
| **Python 3.10+** | 后端调度服务环境 | [Python 官网下载](https://www.python.org/downloads/)（安装时勾选 `Add Python to PATH`） |
| **Google Gemini API Key** | 提供大模型文本总结推理 | [Google AI Studio](https://aistudio.google.com/) 免费创建 API 密钥 |
| **FFmpeg** | 音频提取与轻量格式转换 | 系统级多媒体工具（Windows 可运行 `winget install Gyan.FFmpeg` 安装） |
| **Chrome / Edge 浏览器** | 运行侧边栏扩展 | 任何现代 Chromium 内核浏览器 |
| **SenseVoice (可选)** | **无字幕视频本地识别** | 阿里开源的语音识别模型。若需总结无字幕视频，配置后即可自动离线转写（下文有配置说明） |

---

## 📦 简明安装与配置步骤

### 第一步：克隆仓库到本地

```bash
git clone https://github.com/WallenLee/BiliTube-AI-Summary.git
cd BiliTube-AI-Summary
```

---

### 第二步：安装 FFmpeg

- **Windows**（推荐使用 WinGet 一键安装）：
  ```powershell
  winget install Gyan.FFmpeg
  ```
- **macOS**：
  ```bash
  brew install ffmpeg
  ```
- **Linux (Ubuntu/Debian)**：
  ```bash
  sudo apt update && sudo apt install ffmpeg
  ```

---

### 第三步：安装 Python 后端依赖

```bash
cd backend
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

### 第四步：配置运行参数

1. 复制配置文件模板：
   - Windows CMD / PowerShell:
     ```cmd
     copy config.example.json config.json
     ```
   - Linux / macOS:
     ```bash
     cp config.example.json config.json
     ```
2. 编辑 `backend/config.json`：
   ```json
   {
     "gemini_api_key": "填入你的Google_Gemini_API_Key",
     "gemini_model": "gemini-3.5-flash-lite",
     "proxy_url": "http://127.0.0.1:7897",
     "save_directory": "",
     "auto_save": false,
     "sensevoice_bin": "",
     "sensevoice_model": "",
     "vad_model": "",
     "ffmpeg_bin": "ffmpeg"
   }
   ```
   * *注：若本地配置了 SenseVoice，可将相应可执行文件与模型路径填入 `sensevoice_bin`、`sensevoice_model` 与 `vad_model`，在遇到无字幕视频时会自动启用本地离线识别。若暂不配置，系统优先处理带有在线字幕的视频。*

---

### 第五步：启动本地服务

- **常规启动（带控制台黑框）**：双击运行根目录或 `backend/` 下的 `start_server.bat` 即可；
- **静默后台启动（无黑框无感运行 · 推荐）**：双击运行根目录或 `backend/` 下的 `start_silent.vbs`；如需开机自启，只需为 `start_silent.vbs` 创建桌面快捷方式并拖入 Windows 自启动文件夹（按 `Win + R` 输入 `shell:startup` 回车即可打开自启文件夹）；
- **代码更新与平滑重启**：更新代码后，直接在浏览器插件右上角「⚙️ 设置」面板内点击 **「🔄 重启本地服务」**，即可 1 秒内无感重启并自动加载最新代码！
- **命令行启动**：
  ```bash
  cd backend
  python -m uvicorn main:app --host 127.0.0.1 --port 8765
  ```
看到输出 `Uvicorn running on http://127.0.0.1:8765` 即表示启动成功。

---

### 第六步：加载浏览器插件

1. 打开 Chrome 或 Edge，访问扩展管理页：
   - Chrome 输入：`chrome://extensions/`
   - Edge 输入：`edge://extensions/`
2. 开启右上角 **「开发者模式 (Developer Mode)」** 开关；
3. 点击 **「加载已解压的扩展程序 (Load unpacked)」**（或直接解压 Releases 发布的 `BiliTube-AI-Summary-v1.2.0.zip` 安装）；
4. 选择本项目根目录下的 **`extension`** 文件夹；
5. 将插件固定在工具栏以便日常使用。

---

## 🎮 使用方法

1. 打开任意一个 **B站 (Bilibili)** 或 **YouTube** 视频页面；
2. 点击浏览器工具栏的插件图标，侧边栏滑出；
3. 点击 **「✨ 一键总结」**：
   - 有字幕视频：10~15 秒直接出图；
   - 无字幕视频：后台自动并发提取音频并调用本地 SenseVoice 转写后生成总结；
4. **交互浏览与提问**：
   - **原片跳转**：点击导图、正文或问答中的任意时间戳（如 `⏱️ 04:12`），视频自动同步跳转播放；
   - **划词提问**：在「完整总结」中划选任意文字，点击悬浮条即可一键通俗解释、调取论据或快捷追问；
   - **导图速问**：点击思维导图分支上的 `💬` 图标，针对特定分支向 AI 提问；
   - **伴读答疑**：切换到「💬 伴读答疑」Tab，输入任意疑问，基于全片全字幕上下文获取解答；
   - **本地保存**：点击顶部「💾 保存这篇到本地」，可自由勾选与 AI 的问答记录，一键导出为标准 Markdown (.md) 文档并在本地默认编辑器中打开。

---

## 🔒 隐私、安全与数据流向透明声明 (Privacy & Security First)

为了保障用户的充分知情权与极客级的数据安全，本项目遵循严格透明的数据流向规范：

- **音频与 ASR 离线保障 (100% Local)**：
  - 音频抓取、轻量音轨切片、SenseVoice GPU 语音转写以及 Markdown 笔记存储均在您的计算机本地独立执行；
  - 原始音频和媒体切片**绝不离开您的计算机**，不会上传至任何第三方商业转写云端。
- **大模型文本总结流向 (Cloud & Local Hybrid)**：
  - 生成结构化报告、思维导图及伴读答疑时，提炼后的字幕文本将通过加密 HTTPS 直接发送至**您自主配置的 AI 供应商官方端点**（Google Gemini、Anthropic Claude、OpenAI、DeepSeek 等），绝无任何收集用户数据的第三方中间服务器；
  - **100% 纯本地离线断网方案**：若您对文本数据具有严格的离线断网或私有化要求，可在插件设置中将服务商切换为 **Ollama 本地私有模型**（如 `deepseek-r1:8b` 或 `qwen2.5:14b`），即可实现从语音转写到总结问答的 **100% 全程断网私有运行**。
- **本地 API 跨源与安全防护**：
  - 本地 Python 调度后台采用严格的跨源白名单校验（仅允许扩展程序自身协议与本地回环访问），严禁外部第三方公共网页跨源窃取密钥或恶意调用；
  - 本地文件导出与打开接口内置路径遍历（Path Traversal）与安全扩展名（`.md`）校验，严禁操作任何非文本可执行程序。

---

## 📄 License

本项目采用 [MIT 许可证](LICENSE) 开源。
