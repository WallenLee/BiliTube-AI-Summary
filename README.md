# 🚀 BiliTube-AI-Summary: 彻底攻克无字幕痛点！视频AI思维导图与深度总结助手

<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="BiliTube AI Summary Logo" />
</p>

<p align="center">
  <b>一键将 B站 (Bilibili) 与 YouTube 视频（哪怕没有任何原厂字幕！）提炼为精炼结构化总结与 Markmap 交互式思维导图</b><br>
  🎙️ 内置本地离线语音识别 (SenseVoice GPU加速) · ⚡ 侧边栏无缝伴读 · ⏱️ 点击时间戳原片精准同步跳转 · 💾 一键直存 Obsidian
</p>

<p align="center">
  <img src="https://img.shields.io/badge/无字幕视频支持-100%25_完美支持-success?style=for-the-badge&logo=soundcharts&logoColor=white" alt="No Subtitle Supported">
  <img src="https://img.shields.io/badge/本地离线ASR-SenseVoice_GPU加速-orange?style=for-the-badge" alt="Local ASR">
  <img src="https://img.shields.io/badge/Chrome_Extension-SidePanel_V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Edge_Extension-Supported-green?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Edge Extension">
  <img src="https://img.shields.io/badge/AI_Engine-Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini">
  <img src="https://img.shields.io/badge/License-MIT-purple.svg?style=for-the-badge" alt="License">
</p>

---

## 💥 痛点直击：为什么你需要 BiliTube-AI-Summary？

> 🚨 **你是否经常遇到以下崩溃场景？**
> 
> 兴冲冲打开一个 1~2 小时的 B站深度行业演讲、硬核干货或网课，点开市面上现有的 AI 总结插件，却弹出一行冷冰冰的红字：
> **「该视频没有字幕，无法生成总结」** ❌
> 
> 近年来，**B 站等平台大量下线或收缩了默认提供的 AI 字幕**，导致市面上 **99% 依赖爬取现成字幕的总结插件瞬间瘫痪沦为摆设**！而少数号称能总结无字幕视频的商业软件，不仅按分钟昂贵扣费、强制上传云端排队，还存在严重的隐私泄露风险。

### 🥊 核心维度全面对比

| 对比维度 | 市面上普通总结插件 / 脚本 | 商业收费视频转写云服务 | **🔥 BiliTube-AI-Summary (本项目)** |
| :--- | :--- | :--- | :--- |
| **无字幕视频处理** | ❌ **直接报错崩溃**，完全无法使用 | ⚠️ 强制上传云端，按分钟昂贵扣费 | ✅ **自动无缝唤醒本地 ASR，免费极速转写！** |
| **音频下载技术** | ❌ 无下载能力 | ⚠️ 单线程慢速下载，频遭平台限速 | ✅ **8 线程切片并发 + 32k 极致瘦身 (体积减少 75%)** |
| **语音识别 (ASR)** | ❌ 无 | ⚠️ 依赖云端服务器排队，有长度限制 | ✅ **内置阿里开源 SenseVoice 语音大模型 (支持 GPU 加速)** |
| **时间戳原片联动** | ⚠️ 部分支持但容易漂移 | ❌ 仅输出纯文本，无法联动原片 | ✅ **导图 / 总结 / 字幕全链路点击，原片秒级精准跳转！** |
| **交互思维导图** | ❌ 多数仅输出干瘪流水账 | ❌ 无思维导图 | ✅ **Markmap 树状交互导图，支持自由缩放、深浅色切换** |
| **数据隐私与安全** | ⚠️ 账号 Cookie / 凭据上传云端 | ⚠️ 视频音频全量上传第三方服务器 | ✅ **100% 本地优先 (Local-First)，离线计算零数据收集** |
| **使用成本** | 免费版限制多，诱导开会员 | 极昂贵（几毛到几块钱/分钟） | ✅ **100% 永久免费开源** |

---

## 🌟 核心独家优势与技术亮点

### 1. 🎙️ 独家双通道流水线：彻底攻克“无字幕”行业死穴
- **⚡ 闪电快通道（有字幕时）**：
  扩展直接利用用户浏览器自身的真实登录态，0.2 秒直拉原画清晰度下的官方/AI 字幕并回传后端，**10~15 秒极速出图出总结**，彻底破解后端爬虫 412 限流错误与“假性无字幕”难题。
- **🚀 极速慢通道（彻底无字幕时）**：
  当视频确实无任何字幕时，后端**全自动无缝切入本地 ASR 引擎**：
  1. **音频极致瘦身**：仅提取人声所需的 32k~64k 超轻音频流，文件体积较原视频剧降 **75% 以上**；
  2. **8 线程分块并发**：突破平台对单线程音频流的限速封锁，百兆带宽瞬间拉满；
  3. **SenseVoice 语音大模型**：直投阿里开源 SenseVoice Small 识别大模型，结合 FSMN-VAD 语音断句，配合显卡 Vulkan / CUDA / DirectML 硬件加速，**几十分钟的长音频往往只需数秒至十几秒即可完成全量高精转写**！

### 2. 🧠 Markmap 高对比度交互导图
- 自动将长篇大论提炼为脉络清晰的层级思维导图；
- 节点自带高对比度半透明磨砂气泡卡片，彻底避免字体发暗发虚；
- 支持深色底 🌙 / 纯净浅色底 ☀️ 一键切换，支持鼠标滚轮缩放与节点拖拽展开。

### 3. ⏱️ 全链路时间戳联动（点击秒跳原片）
- 在**思维导图节点**、**完整总结正文**或**字幕列表**中，点击任意时间标记（如 `⏱️ 03:25`）；
- 插件会自动向左侧标签页发送同步指令，**视频播放器瞬间精准跳转至对应瞬间**，告别盲目拖进度条！

### 4. 🎯 拒绝流水账：深度务实的总结结构
- **💡 一句话主旨**：100% 忠实还原全片核心结论；
- **🎯 核心深度洞见**：
  - **背景与痛点**：直击现实矛盾与提出背景；
  - **推演脉络与机制**：深入剖析因果推导，并将**关键数据、事实案例、历史事件紧密融合在推演过程中**；
  - **术语解析**：严格按需（有则全列，无则不写），每个术语均提供「专业学术定义 + 通俗白话比喻」双重视角；
- **🧠 脉络思维导图**：时间线与逻辑融合的纯净层级树。

### 5. 💾 一键存入本地 & Obsidian 双链笔记联动
- 尊重用户习惯，默认不强制保存；点击「保存这篇到本地」才生成整洁 Markdown；
- 设置中支持弹出 **Windows 原生文件夹选择器**，图形化一键点选个人 Obsidian 库；保存后支持一键通过 `obsidian://open` 唤醒软件阅读。

---

## 🛠️ 环境依赖与准备

| 依赖项 | 作用 | 说明与获取方式 |
| :--- | :--- | :--- |
| **Python 3.10+** | 本地调度后端运行环境 | [Python 官网下载](https://www.python.org/downloads/)（安装时请勾选 `Add Python to PATH`） |
| **Google Gemini API Key** | 提供大模型文本总结推理 | [Google AI Studio](https://aistudio.google.com/) 免费申请（免服务器费用、额度充足） |
| **FFmpeg** | 音频流提取与轻量转码 | 系统级多媒体工具（Windows 执行 `winget install Gyan.FFmpeg` 即可） |
| **Chrome / Edge 浏览器** | 运行侧边栏扩展 | 现代 Chromium 内核浏览器均可 |
| **SenseVoice (可选)** | **无字幕视频本地识别核心** | 阿里开源极速 ASR，推荐配备以便在无字幕时自动离线转写（下文提供配置说明） |

---

## 📦 极速安装与配置指南

### 第一步：克隆仓库到本地

```bash
git clone https://github.com/WallenLee/BiliTube-AI-Summary.git
cd BiliTube-AI-Summary
```

---

### 第二步：安装 FFmpeg（音频提取必备）

- **Windows 用户（强烈推荐一键安装）**：
  ```powershell
  winget install Gyan.FFmpeg
  ```
  *(或从 [Gyan.dev](https://www.gyan.dev/ffmpeg/builds/) 下载解压，并将 `bin` 目录路径加入系统环境变量 PATH)*
- **macOS 用户**：
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

### 第四步：填写基本配置

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
   * *注：若您本地部署了 SenseVoice，只需将编译好的可执行文件路径与 GGUF 模型路径填入 `sensevoice_bin`、`sensevoice_model` 与 `vad_model` 即可畅享极速离线转写！若暂不配置，系统将优先走在线字幕嗅探通道。*

---

### 第五步：启动本地调度服务

- **Windows 用户**：直接双击运行 `backend/start_server.bat` 即可；
- **全平台终端启动**：
  ```bash
  cd backend
  python -m uvicorn main:app --host 127.0.0.1 --port 8765
  ```
终端显示 `Uvicorn running on http://127.0.0.1:8765` 即表示引擎已就绪。

---

### 第六步：加载浏览器插件

1. 打开 Chrome 或 Edge，访问扩展管理页：
   - Chrome 输入：`chrome://extensions/`
   - Edge 输入：`edge://extensions/`
2. 开启右上角 **「开发者模式 (Developer Mode)」** 开关；
3. 点击 **「加载已解压的扩展程序 (Load unpacked)」**；
4. 选择本项目根目录下的 **`extension`** 文件夹；
5. 点击浏览器右上角拼图图标，把 **「AI 视频总结与思维导图助手」** 钉在工具栏上。

---

## 🎮 使用方法

1. 打开任意一个 **B站 (Bilibili)** 或 **YouTube** 视频页面（**有无字幕均可！**）；
2. 点击浏览器工具栏的插件图标，右侧滑出交互侧边栏（SidePanel）；
3. 点击 **「一键生成总结与思维导图」**：
   - **有字幕时**：10~15 秒极速出图；
   - **无字幕时**：后台自动开启 8 线程并发下载并调用本地 SenseVoice 极速转写；
4. **自由互动**：
   - 点击导图或正文中的任意时间戳（如 `⏱️ 04:12`），原视频立刻跳转播放；
   - 切换思维导图深浅色模式，滚轮无级缩放查看全貌；
   - 点击底部「💾 保存这篇到本地」，一键同步到 Obsidian！

---

## 🔒 隐私与安全性保障 (Privacy First)

- **真正 Local-First 本地优先**：不设中心化收集服务器，您的视频数据、识别音频和总结内容全部留在您的电脑上；
- **凭据本机构建**：Gemini API Key 仅保存在本地 `config.json` 中，直连 Google 官方端点；
- **复用浏览器现有身份**：B 站字幕抓取完全复用您浏览器现有的安全登录态，绝不外泄您的账号密码与敏感 Token。

---

## 📄 License

本项目采用 [MIT 许可证](LICENSE) 开源。欢迎点亮 **⭐️ Star**，让更多被“无字幕”困扰的朋友找到利器！
