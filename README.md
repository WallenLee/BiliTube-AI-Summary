# 🚀 BiliTube-AI-Summary (视频AI思维导图与深度总结助手)

<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="BiliTube AI Summary Logo" />
</p>

<p align="center">
  <b>一键将 B站 (Bilibili) 与 YouTube 长视频提炼为精炼结构化总结与 Markmap 交互式思维导图</b><br>
  ⚡ 浏览器侧边栏无缝伴读 · ⏱️ 点击时间戳原片同步精准跳转 · 🧠 知识脉络思维导图 · 💾 一键直存 Obsidian
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome_Extension-SidePanel_V3-blue?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Edge_Extension-Supported-green?logo=microsoftedge&logoColor=white" alt="Edge Extension">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/AI_Engine-Google_Gemini-4285F4?logo=google&logoColor=white" alt="Google Gemini">
  <img src="https://img.shields.io/badge/Local_ASR-SenseVoice_Vulkan-orange" alt="SenseVoice">
  <img src="https://img.shields.io/badge/License-MIT-purple.svg" alt="License">
</p>

---

## 💡 为什么选择 BiliTube-AI-Summary？

面对 1~2 小时的长视频、讲座或网课，市面上的总结工具要么**收费昂贵**、要么**受制于平台防爬虫限制导致无字幕视频失败**、要么**输出冗长无重点的流水账**。

**BiliTube-AI-Summary** 是一套专为知识学习者打造的**本地优先 (Local-First)** 开源视频提炼工具：
1. **⚡ “近水楼台”直取 B 站 AI 字幕**：利用浏览器扩展直接以用户自身登录态在 0.2 秒内获取原画清晰度下的 B 站官方/AI 字幕，**10~15 秒极速出图**，彻底解决后端爬虫 412 错误与“假性无字幕”难题。
2. **🧠 Markmap 高对比度交互导图**：自动将长内容提炼为层次分明的思维导图，支持自由缩放、拖拽展开，自带高对比磨砂气泡卡片，提供深色 🌙 / 浅色 ☀️ 双主题。
3. **⏱️ 全链路时间戳联动**：无论在导图节点、完整总结还是字幕面板，**点击任意时间戳（如 `⏱️ 03:25`），左侧网页播放器瞬间跳转对应进度**，快速定位核心论点。
4. **🎯 深度务实、深入浅出的总结结构**：
   - **一句话主旨**：精准提炼全片核心议题；
   - **核心深度洞见**：充分展开原片论证逻辑（150~300字深度解析），并为专业术语提供「专业学术解释 + 通俗白话比喻」双重视角；
   - **脉络思维导图**：融合时间线与逻辑结构的树状导图。
5. **🎙️ 本地极速 ASR 兜底通道**：遇到真正无字幕的视频，内置 8 线程音频瘦身并发下载 + 本地 SenseVoice 离线语音大模型（支持 GPU 加速），无惧任何视频。
6. **🔒 隐私安全 & 免费开源**：配置与 API Key 均保存在本地，直连官方 API，零中转、零数据收集，支持一键导出 Markdown 并联动 Obsidian 库。

---

## 🛠️ 环境依赖与准备

运行本项目需要以下核心环境支持：

| 依赖项 | 作用 | 是否必须 | 说明与获取方式 |
| :--- | :--- | :--- | :--- |
| **Python 3.10+** | 本地调度与 AI 接入后端 | **必须** | [Python 官网下载](https://www.python.org/downloads/)（安装时勾选 `Add Python to PATH`） |
| **Google Gemini API Key** | 提供大模型文本总结推理 | **必须** | [Google AI Studio](https://aistudio.google.com/) 免费创建 API 密钥 |
| **FFmpeg** | 音频流处理与格式转换 | **必须** | 系统级音频转码工具，详见下方安装步骤 |
| **Chrome / Edge 浏览器** | 运行前端侧边栏扩展 | **必须** | 基于 Chromium 内核现代浏览器均可 |
| **SenseVoice (可选)** | 真正无字幕视频的本地离线识别 | 可选 | 遇到无字幕视频时本地快速听翻，有官方字幕时无需启动 |

---

## 📦 详细安装与配置指南

### 第一步：克隆仓库到本地

打开终端（CMD / PowerShell / Terminal），执行：

```bash
git clone https://github.com/WallenLee/BiliTube-AI-Summary.git
cd BiliTube-AI-Summary
```

---

### 第二步：安装 FFmpeg

FFmpeg 是音视频提取的核心工具，请根据操作系统安装并配置系统环境变量：

- **Windows 用户**（任选一种）：
  - **方法 1（推荐）**：使用 WinGet 一键安装：
    ```powershell
    winget install Gyan.FFmpeg
    ```
  - **方法 2**：从 [Gyan.dev](https://www.gyan.dev/ffmpeg/builds/) 下载解压后，将 `bin` 目录路径添加到系统的环境变量 `Path` 中。
- **macOS 用户**：
  ```bash
  brew install ffmpeg
  ```
- **Linux (Ubuntu/Debian) 用户**：
  ```bash
  sudo apt update && sudo apt install ffmpeg
  ```

验证安装：在终端输入 `ffmpeg -version`，能正常输出版本号即表示安装成功。

---

### 第三步：安装 Python 后端依赖

建议在 `backend` 目录下创建虚拟环境或直接安装依赖：

```bash
cd backend
pip install -r requirements.txt
```

> **提示**：如果国内安装速度较慢，可使用清华镜像源加速：
> ```bash
> pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
> ```

---

### 第四步：配置 API Key 与运行参数

1. 在 `backend` 目录下，复制配置模板：
   - Windows PowerShell / CMD:
     ```cmd
     copy config.example.json config.json
     ```
   - Linux / macOS:
     ```bash
     cp config.example.json config.json
     ```
2. 打开 `backend/config.json`，按需修改各项配置：

```json
{
  "gemini_api_key": "在这里填入你的Google_Gemini_API_Key",
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

**配置项解析**：
- `gemini_api_key`：你的 Gemini API 密钥（在 [Google AI Studio](https://aistudio.google.com/) 免费申请）；
- `gemini_model`：默认推荐 `gemini-3.5-flash-lite`（速度极快、额度充沛，内置故障自动降级切换）；
- `proxy_url`：国内网络需配置科学上网代理端口（如 Clash 默认 `http://127.0.0.1:7897` 或 v2ray 默认 `http://127.0.0.1:10809`）；若无需代理可填 `""`；
- `save_directory`：Markdown 文件导出的默认目录，留空时可在浏览器插件设置界面通过图形窗口点选你的 Obsidian 库；
- `ffmpeg_bin`：若 FFmpeg 已加入系统 PATH，保持默认 `"ffmpeg"` 即可。

---

### 第五步：启动本地后端服务

- **Windows 用户**：双击运行 `backend/start_server.bat` 即可启动服务。
- **命令行方式**（全平台）：
  ```bash
  cd backend
  python -m uvicorn main:app --host 127.0.0.1 --port 8765
  ```
看到终端输出 `Uvicorn running on http://127.0.0.1:8765` 时，即代表本地调度引擎就绪！

---

### 第六步：加载 Chrome / Edge 侧边栏插件

1. 打开浏览器，进入扩展程序管理页：
   - **Chrome**: 地址栏输入 `chrome://extensions/`
   - **Edge**: 地址栏输入 `edge://extensions/`
2. 打开右上角的 **「开发者模式 (Developer Mode)」** 开关；
3. 点击左上角的 **「加载已解压的扩展程序 (Load unpacked)」**；
4. 在弹出的文件选择器中，选中本项目根目录下的 **`extension`** 文件夹；
5. 点击浏览器右上角拼图图标，把 **「AI 视频总结与思维导图助手」** 钉在工具栏上。

---

## 🎮 使用方法

1. 打开任意一个 **B站 (Bilibili)** 或 **YouTube** 视频播放页面；
2. 点击浏览器工具栏的插件图标，右侧将滑出交互侧边栏（SidePanel）；
3. 点击 **「一键生成总结与思维导图」**：
   - 优先极速嗅探提取字幕，Gemini 实时流式生成并渲染思维导图；
4. **功能互动**：
   - **点击时间戳**：在导图或总结正文中点击带有时钟标记的时间（如 `04:12`），左侧网页中的视频会自动同步跳转播放；
   - **导图操作**：支持鼠标滑轮缩放、左键拖拽平移、节点收起与展开，点击右上角可一键切换深浅色模式；
   - **保存到本地**：点击底部「💾 保存这篇到本地」，将当前总结生成优雅的 Markdown 文件，并可直接在 Obsidian 等笔记软件中打开。

---

## 📂 项目结构

```text
BiliTube-AI-Summary/
├── backend/                    # Python FastAPI 本地调度后端
│   ├── ai_gemini.py           # Gemini 客户端与多模型故障自动降级容灾链
│   ├── asr_sensevoice.py      # 本地 SenseVoice 离线语音识别封装 (GPU加速)
│   ├── config.py              # 配置加载与管理模块
│   ├── config.example.json    # 配置文件模板 (避免敏感信息泄露)
│   ├── dual_sub_engine.py     # 双通道字幕处理流水线 (极速嗅探 + 并发下载兜底)
│   ├── exporter.py            # Markdown 文档生成与 Obsidian 关联 URI
│   ├── main.py                # FastAPI 路由、SSE 流式接口与桌面弹窗选择器
│   ├── requirements.txt       # Python 依赖清单
│   └── start_server.bat       # Windows 一键启动脚本
├── extension/                  # 浏览器侧边栏扩展 (Chrome/Edge Manifest V3)
│   ├── icons/                 # 插件高清多尺寸图标
│   ├── lib/                   # 离线打包依赖 (Markmap, D3.js, Marked)
│   ├── background.js          # Service Worker 侧边栏管理
│   ├── content_script.js      # 网页端字幕直拉嗅探与播放器精准 Seek 控制
│   ├── manifest.json          # Chrome Extension V3 配置文件
│   ├── sidepanel.css          # 高对比度磨砂气泡卡片与深浅主题样式
│   ├── sidepanel.html         # 侧边栏三栏页面 (导图 / 完整总结 / 字幕原文)
│   └── sidepanel.js           # 前端数据流调度、Markmap 渲染与时间戳事件代理
├── LICENSE                     # MIT 开源协议
└── README.md                   # 项目使用与安装说明文档
```

---

## 🔒 隐私与安全性保障 (Privacy First)

- **无中心化云服务器**：本项目为纯粹的 Local-First 架构，没有搭建任何收集用户数据的中转服务器；
- **凭据本机构建**：你的 Gemini API Key 仅保存在本地 `backend/config.json` 中，调用直接面向 Google 官方端点；
- **利用浏览器现有身份**：B 站字幕读取复用浏览器原有的本地 Cookie，免除将敏感 Cookie 导出或上传到第三方服务的风险。

---

## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！如果你觉得这个工具有所帮助，请给项目点一个 **⭐️ Star**，让更多需要提炼视频知识的朋友看到！

---

## 📄 License

本项目采用 [MIT 许可证](LICENSE) 开源。
