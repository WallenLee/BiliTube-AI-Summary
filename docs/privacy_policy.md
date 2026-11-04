# 隐私政策 (Privacy Policy)

**生效日期 / Effective Date**: 2026-11-04  
**项目名称 / Extension**: BiliTube - AI 视频总结与思维导图助手 (AI Video Summary & Mindmap Studio)  
**开发者 / Developer**: Wallen Lee (GitHub: [@WallenLee](https://github.com/WallenLee/BiliTube-AI-Summary))

---

## 1. 概述 / Overview
本扩展程序（"BiliTube - AI 视频总结与思维导图助手"）高度重视并全力保护每一位使用者的个人隐私。本隐私政策明确阐明我们在您使用本扩展程序和配套本地调度服务时，如何处理与保护您的相关数据。

**核心准则：我们坚守「零数据收集、本地隐私优先」原则。开发者不拥有、不运营任何用于存储用户浏览历史、个人凭据或视频总结内容的中心化服务器，绝不收集、不出售任何个人隐私数据。**

---

## 2. 数据收集与使用 / Data Collection & Usage

### 2.1 浏览器与视频数据 (Browser & Video Data)
- **获取范围**：本扩展仅在您主动浏览的特定视频播放页面（如 `bilibili.com`、`youtube.com`）时，读取当前激活标签页的视频标题、视频播放 URL 以及播放器内的公开发布字幕文本。
- **使用目的**：仅用于提取字幕文本并由 AI 模型生成内容提纲、思维导图及结构化问答。
- **数据存储**：所有视频信息仅暂时保留在您的本地浏览器会话（Session Storage）和本地磁盘中，**绝不会上传至任何第三方的远程跟踪服务器或开发者服务器**。

### 2.2 API 密钥与第三方大模型服务 (API Keys & AI Services)
- **API 密钥存储**：您在设置面板中填写的 Google Gemini API Key 仅保存在您本地电脑的配置文件（`config.json`）及浏览器的本地存储中，不会通过网络泄露给除 Google 官方 API 之外的任何第三方。
- **第三方调用**：当您发起总结或问答时，字幕文本与提问内容将通过加密安全信道（HTTPS）直接发送至 Google 官方 Gemini API 服务节点。相关数据的处理受 [Google 隐私权政策](https://policies.google.com/privacy) 约束。

### 2.3 本地离线语音识别 (Local Offline SenseVoice ASR)
- 对于缺乏原生官方字幕的视频，插件配套的本地后台调度服务（运行于 `http://127.0.0.1:8765`）利用您本地计算机安装的开源语音模型（如 SenseVoice）在您自己的本地显卡或 CPU 上进行离线转写。
- 整个音频转写过程 100% 在本地完成，**音频文件绝不会上传到任何外部云端服务器**。

### 2.4 本地文档存储与导出 (Local Markdown Storage)
- 导出的 Markdown 文档、思维导图与伴读问答记录均直接存储在您通过设置面板指定的本地计算机文件夹（如 Obsidian 知识库或本地文档目录）。
- 开发者无法访问、读取或修改您的任何本地文件。

---

## 3. 权限申请说明 / Permission Disclosures

根据 Microsoft Edge Add-ons 和 Google Chrome Web Store 规范，本扩展申请的权限及其合规用途如下：

| 申请权限 | 权限用途与合规说明 |
| :--- | :--- |
| `sidePanel` | 用于在浏览器右侧侧边栏中渲染总结报告、Markmap 交互思维导图与 AI 伴读对话界面。 |
| `activeTab` / `tabs` | 仅在用户使用插件时，感知当前活动标签页是否为支持的视频网址，以展示对应的视频标题并联动时间戳。 |
| `scripting` | 在当前视频播放页面注入轻量级 Content Script，以安全读取播放器原生公开发布的字幕轨，并响应时间戳点击以控制视频进度跳转。 |
| `storage` | 在浏览器本地安全存储用户选择的明暗主题、字号缩放偏好以及当前任务会话状态。 |
| `host_permissions` | 声明对 Bilibili、YouTube 及本地服务端口 `http://127.0.0.1:8765/*` 的通信权限，用于拉取字幕与控制本地开源调度程序。 |

---

## 4. 政策变更与联系我们 / Contact Us

如本隐私政策有任何重大变更，我们将在 GitHub 开源仓库及扩展版本更新日志中公示。

如果您对本隐私政策或扩展的数据处理有任何疑问、建议或合规咨询，欢迎通过以下渠道与我们联系：
- **GitHub Issues**: [https://github.com/WallenLee/BiliTube-AI-Summary/issues](https://github.com/WallenLee/BiliTube-AI-Summary/issues)
- **官方开源仓库**: [https://github.com/WallenLee/BiliTube-AI-Summary](https://github.com/WallenLee/BiliTube-AI-Summary)
