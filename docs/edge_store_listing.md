# Microsoft Edge Add-ons 商店上架资料包 (Store Listing Assets)

此文档整理了在 **Microsoft Edge 外接程序合作伙伴中心 (Partner Center)** 上架提审所需的所有文本材料、分类标签、权限说明及审核人员备注（Notes for Certification）。您可以直接复制粘贴使用。

---

## 1. 基础信息 (Basic Information)

| 字段名称 (Field) | 填写内容 (Value) | 备注说明 |
| :--- | :--- | :--- |
| **扩展名称 (Extension Name)** | `AI 视频总结与思维导图助手 (BiliTube)` | 支持中英双语显示 |
| **英文名称 (English Name)** | `BiliTube - AI Video Summary & Mindmap Studio` | 英文商店备选 |
| **简短描述 (Short Description)** | `一键提取 B站与 YouTube 视频字幕，使用 AI 极速生成脉络思维导图与结构化深度总结报告，支持精准时间戳跳转与本地 Markdown 知识库保存。` | ≤ 100 字符，精炼概括 |
| **主要语言 (Default Language)** | `中文 (简体) - zh-CN` | 可按需添加 `English - en-US` |
| **主分类 (Category)** | `生产力工具 (Productivity)` | 核心类别 |
| **次要分类 (Secondary Category)** | `搜索与实用工具 (Search & Utilities)` | 备选类别 |
| **年龄分级 (Age Rating)** | `全年龄 / 3+ (General Audience)` | 无任何不良内容 |
| **价格 (Pricing)** | `免费 (Free)` | 完全免费开放 |
| **代码开源地址 (Website / Repo)** | `https://github.com/WallenLee/BiliTube-AI-Summary` | 提高审核信任度 |
| **隐私政策链接 (Privacy Policy URL)** | `https://github.com/WallenLee/BiliTube-AI-Summary/blob/main/docs/privacy_policy.md` | 必填项，符合微软要求 |
| **支持邮箱 (Support Email)** | 开发者个人邮箱 (如提交账号绑定邮箱) | 用于用户咨询与审核反馈 |

---

## 2. 搜索关键词 / 标签 (Search Keywords & Tags)

在 Edge 商店中可添加最多 10 个搜索标签（建议填入）：
`视频总结`, `思维导图`, `B站总结`, `YouTube总结`, `AI伴读`, `知识管理`, `Obsidian`, `Gemini`, `字幕提取`, `学习助手`

---

## 3. 详细描述 (Detailed Description)

在「Store listings」->「Detailed description」框中粘贴以下内容（支持 Markdown / 换行排版）：

```markdown
🚀 BiliTube - 专为长视频学习者、科研考研党与知识工作者打造的「AI 视频总结与交互思维导图助手」！

遇到 1~2 小时的深度访谈、技术教程、网课视频没时间看完？
一键提取视频字幕，依托 Google Gemini 顶尖大语言模型，秒级生成清晰的「一句话主旨」、「核心深度洞见」与「Markmap 交互式脉络思维导图」，大幅提升视频信息摄取效率！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 核心亮点功能
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ⚡ 多平台一键极速总结：
   - 深度适配 Bilibili (B站) 与 YouTube 视频播放页。
   - 打开侧边栏轻点「一键总结」，自动提取字幕并实时流式生成报告。

2. 🧠 Markmap 交互式动态思维导图：
   - 自动梳理视频的核心逻辑骨架与各章节论据。
   - 导图支持无限拖拽、层级折叠展开、深浅色模式切换与全图重置。
   - 带有 [00:15] 视频时间戳标记，点击即可在原视频中精准跳转播放！

3. 🎙️ 双字幕引擎与离线 SenseVoice 语音识别：
   - 优先极速匹配官方中英双语字幕轨。
   - 针对无官方字幕的访谈/科普视频，无缝联动本地开源阿里 SenseVoice GPU 模型，全离线高速转写，隐私安全无虞！

4. 💬 划词交互与深度伴读问答：
   - 总结报告中不懂的生词或观点？鼠标划词弹出「通俗解释」、「展开论据」、「一键追问」浮动菜单。
   - 支持多轮智能追问，深度理解视频内涵。

5. 💾 原位保存与本地 Markdown 知识库联动：
   - 支持自由勾选将哪些伴读问答与主干总结一并导出。
   - 原位写入电脑本地文件夹（如 Obsidian 知识库、Notion 导入目录）。后续追问后可一键追加更新，绝不重复生成冗余文件。

6. 🎨 极致舒适的阅读体验：
   - 完美适配明暗双色主题（白天清爽护眼，夜晚沉浸深邃）。
   - 按住 Ctrl + 鼠标滚轮（或快捷键 Ctrl +/-）可无极自由缩放侧边栏字号。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 隐私安全与本地服务说明
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 本扩展遵循「零数据收集、本地隐私优先」原则。
- 扩展不设开发者中央服务器，不收集您的任何浏览历史或视频记录。
- API 密钥仅保存在您的本地电脑中，直连 Google 官方接口；
- 音视频切片与离线转写由配套的本地开源轻量调度服务（运行于 http://127.0.0.1:8765）安全执行，源码 100% 开放于 GitHub。
```

---

## 4. 权限合理性申明 (Permission Justifications)

在提交 Edge 审核表单的权限申明项（或 Notes for Certification）中，提供给审核员的依据：

1. **`sidePanel`**:
   - *用途*: 在 Edge 侧边栏 (Side Panel) 中常驻显示视频总结报告、Markmap 思维导图与 AI 伴读对话界面，不遮挡主视频播放。
2. **`activeTab` & `tabs`**:
   - *用途*: 仅在用户打开扩展时获取当前激活视频标签页的 URL 及页面标题，用于自动识别视频平台并匹配字幕。
3. **`scripting`**:
   - *用途*: 在当前视频页注入轻量脚本，提取播放器 DOM 中渲染的原生字幕文本，并实现点击时间戳时控制 HTML5 播放器精确跳转进度。
4. **`storage`**:
   - *用途*: 仅在本地持久化存储用户界面的主题设置（暗色/亮色）、字号缩放比例以及当前活跃会话状态，关闭侧边栏不丢失草稿。
5. **`host_permissions` (`*.bilibili.com/*`, `*.youtube.com/*`, `http://127.0.0.1:8765/*`)**:
   - *用途*: 访问 B站与 YouTube 网页以提取公开发布的字幕轨，并通过本地回环端口与用户自己机器上运行的本地轻量调度程序通信。

---

## 5. 审核人员专属备注 (Notes for Certification - 必填防驳回)

> 💡 **极为关键**：向微软审核团队清晰解释本地服务 (127.0.0.1:8765) 的工作方式与测试方法，可有效防止因审核员无法连接后台而导致的审核驳回！

请在提交时的 **「Notes for certification」** 文本框中粘贴以下内容：

```text
Dear Microsoft Edge Add-ons Review Team,

Thank you for reviewing "BiliTube - AI Video Summary & Mindmap Studio"!

### 1. Companion Local Server Explanation
To protect user privacy and allow local GPU offline speech-to-text (SenseVoice) without uploading any audio to third-party cloud servers, this extension is designed to communicate with a lightweight local companion server running at http://127.0.0.1:8765.
The companion server is 100% open-source and free, available at our GitHub repository:
https://github.com/WallenLee/BiliTube-AI-Summary

### 2. How to Test the Extension During Review:
Option A (Quick UI & Subtitle Inspection):
1. Load the unpacked extension in Microsoft Edge.
2. Open any Bilibili or YouTube video (e.g., https://www.youtube.com/watch?v=CKgAWkuP-Ak or https://www.bilibili.com/video/BV1xx411c7mD).
3. Click the extension icon in the toolbar or Edge side panel.
4. The extension UI displays the video title and platform. Users can click the "📖" (Guide) icon in the top header to view the built-in Diagnostics HUD and 3-step setup walkthrough.

Option B (Full End-to-End Summarization):
If the review team would like to test the live AI summarization and Markmap rendering:
1. Clone the repo or download the release from https://github.com/WallenLee/BiliTube-AI-Summary/releases
2. Run `start_server.bat` in the backend folder (starts FastAPI on port 8765).
3. Enter a valid Google Gemini API Key in the Extension Settings modal (a free key can be obtained at https://aistudio.google.com/app/apikey).
4. Click "✨ 一键总结" on any video page to see the generated summary and interactive Markmap mindmap.

All bundled scripts (d3, marked, markmap) are completely local and offline under the /lib directory with zero remote code execution.

If you have any questions, please feel free to reach out via GitHub Issues or email. Thank you!
```

---

## 6. 视觉宣传资产规范 (Visual Assets)

在 Partner Center 上传图像资产时的规格参考：
1. **Logo 图标**:
   - `128x128 像素` PNG 格式（使用 `extension/icons/icon128.png`）。
2. **商店宣传截图 (Store Screenshots)**:
   - 推荐尺寸：`1280 x 800` 或 `1920 x 1080` 像素（16:10 或 16:9 比例，PNG 格式）。
   - 数量：建议 2~4 张，展示核心场景：
     * 截图 1: B站/YouTube 页面伴随 Edge 侧边栏生成的「Markmap 交互思维导图」；
     * 截图 2: 结构化「深度报告」与时间戳联动跳转；
     * 截图 3: 划词解释与「AI 伴读追问」对话气泡；
     * 截图 4: 新手引导配置与「运行环境实时自检 HUD」弹窗。
