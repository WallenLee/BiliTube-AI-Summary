# Microsoft Edge 扩展商店一步一步上架指南

本指南将带你从零开始，手把手在 **Microsoft Edge 外接程序合作伙伴中心 (Partner Center)** 提交并上架 `BiliTube - AI 视频总结与思维导图助手`。

> 💡 **核心优势**：
> - **完全免费**：微软 Edge 扩展开发者账号**无需任何注册费用**（对比谷歌 Chrome 商店需要 5 美元信用卡认证费）。
> - **审核迅速**：通常 1 ~ 3 个工作日完成机器与人工审核。
> - **全球分发**：上架后全网 Edge 浏览器用户均可一键从官方商店添加。

---

## 阶段一：注册与登录微软开发者账号 (约 3 分钟)

### 第一步：访问 Partner Center
1. 打开浏览器，访问 **[Microsoft 合作伙伴中心 (Partner Center)](https://partner.microsoft.com/zh-cn/dashboard/microsoftedge/public/login)**。
2. 点击右上角或页面中央的 **「立即注册」** 或 **「登录」**。
3. 使用你现有的微软个人账号（Outlook / Hotmail / Live 账号）登录。如果没有，直接点击创建新微软账号。

### 第二步：完成开发者身份登记
1. 首次进入时，系统会要求你填写开发者个人信息：
   - **国家/地区**：选择 `中国 (China)`。
   - **账户类型**：选择 **`个人 (Individual)`**。
   - **发布者显示名称 (Publisher display name)**：输入你想对外展示的开发者名（例如：`Wallen Lee` 或 `BiliTube Studio`）。
   - **联系人邮箱与电话**：填写你的常用邮箱并完成手机短信验证码校验。
2. 勾选同意《Microsoft Edge 外接程序开发者协议》，点击 **「完成注册」**。
3. 注册成功后，页面会自动跳转到 **Microsoft Edge 扩展程序开发人员仪表板**。

---

## 阶段二：创建新扩展并上传安装包 (约 2 分钟)

### 第一步：创建新扩展
1. 在仪表板首页，点击右上角醒目的蓝色按钮 **「+ 创建新扩展程序」(+ Create new extension)**。
2. 此时页面会提示你上传 `.zip` 安装包。

### 第二步：上传 Release 压缩包
1. 点击「浏览文件」或直接将根目录下打包好的 **`BiliTube-AI-Summary-Edge-v1.3.4.zip`** 拖拽入虚线框中。
2. 系统会自动解析压缩包中的 `manifest.json`，校验清单语法、版本号 `1.3.4` 与扩展权限：
   - 校验通过后，页面会显示绿色的对勾「Package validated successfully」。
3. 点击 **「继续」**，进入详细属性与元数据配置页。

---

## 阶段三：填写扩展上架元数据 (对照资料包直接复制)

左侧导航栏包含几个必填标签页，依次点击填写：

### 1. 「应用商店详情 (Store listings)」
点击 `中文 (简体)`（或添加语言）：
- **扩展程序名称**：`AI 视频总结与思维导图助手 (BiliTube)`
- **简短描述 (Short description)**：
  > 一键提取 B站与 YouTube 视频字幕，使用 AI 极速生成脉络思维导图与结构化深度总结报告，支持精准时间戳跳转与本地 Markdown 知识库保存。
- **详细说明 (Detailed description)**：
  - 打开 `docs/edge_store_listing.md` 文件，复制第 3 节中的「详细描述 Markdown 内容」并粘贴进去。
- **扩展程序图标 (Extension icon)**：
  - 点击上传，选择项目下的 `extension/icons/icon128.png` (128x128 像素)。
- **应用商店搜索词 (Search terms)**：
  - 添加：`视频总结`, `思维导图`, `B站总结`, `YouTube总结`, `AI伴读`, `知识管理`, `Obsidian`, `Gemini`, `字幕提取`, `学习助手`
- **屏幕截图 (Screenshots)**：
  - 微软要求至少上传 **1 张** 1280x800 或 1920x1080 尺寸的截图。
  - 你可以在 Edge 浏览器中打开 B 站或 YouTube 任意视频，打开侧边栏总结完成后截一张高清全屏图或窗口图上传。
- **YouTube 视频演示链接 (可选)**：如有可填，无则留空。

### 2. 「属性 (Properties)」
- **类别 (Category)**：选择 **`生产力 (Productivity)`**。
- **内容评分 (Content rating)**：选择适合所有受众（不含成人或敏感内容）。
- **支持联系信息 (Support contact info)**：
  - **网站网址**：`https://github.com/WallenLee/BiliTube-AI-Summary`
  - **支持邮箱**：填写你的联系邮箱。
- **隐私权政策 URL (Privacy policy URL)**（**必填**）：
  - 填入：`https://github.com/WallenLee/BiliTube-AI-Summary/blob/main/docs/privacy_policy.md`

### 3. 「可用性 (Availability)」
- **可见性**：保持默认的「公开 (Public)」。
- **市场选择**：选择「所有市场 (All markets)」或勾选中国区与主流地区。
- **定价**：默认「免费 (Free)」。

---

## 阶段四：填写审核人员备注 (Notes for Certification - 核心防驳回)

在左侧导航栏点击 **「提交 (Submit)」** 预览页面的 **「Notes for certification (认证备注)」**：

> ⚠️ **为什么这步必须填？**  
> 微软审核员测试插件时，若在纯沙箱机器上点击「一键总结」，会发现后台返回本地服务未连接。如果未加说明，审核员可能会直接判定为「功能不可用」驳回。

**请直接复制以下英文说明粘贴到「Notes for certification」中**：

```text
Dear Microsoft Edge Add-ons Review Team,

Thank you for reviewing "BiliTube - AI Video Summary & Mindmap Studio"!

### 1. Companion Local Server Explanation
To protect user privacy and allow local GPU offline speech-to-text (SenseVoice) without uploading any audio to third-party cloud servers, this extension is designed to communicate with a lightweight local companion server running at http://127.0.0.1:8765.
The companion server is 100% open-source and free, available at our GitHub repository:
https://github.com/WallenLee/BiliTube-AI-Summary

### 2. How to Test the Extension During Review:
Option A (Quick UI & Subtitle Inspection):
1. Load the extension in Microsoft Edge.
2. Open any Bilibili or YouTube video (e.g., https://www.youtube.com/watch?v=CKgAWkuP-Ak or https://www.bilibili.com/video/BV1xx411c7mD).
3. Click the extension icon in the toolbar or Edge side panel.
4. The extension UI displays the video title and platform. Users can click the "📖" (Guide) icon in the top header to view the built-in Diagnostics HUD and 3-step setup walkthrough.

Option B (Full End-to-End Summarization):
If the review team would like to test the live AI summarization and Markmap rendering:
1. Download the release package from https://github.com/WallenLee/BiliTube-AI-Summary/releases
2. Run `start_server.bat` in the backend folder (starts FastAPI on port 8765).
3. Enter a valid Google Gemini API Key in the Extension Settings modal (a free key can be obtained at https://aistudio.google.com/app/apikey).
4. Click "✨ 一键总结" on any video page to see the generated summary and interactive Markmap mindmap.

All bundled scripts (d3, marked, markmap) are completely local and offline under the /lib directory with zero remote code execution.

If you have any questions, please feel free to reach out via GitHub Issues or email. Thank you!
```

---

## 阶段五：点击提交与等待发布

1. 确认所有必填项前均显示绿色对勾（Valid）。
2. 点击页面右上角的蓝色按钮 **「发布 (Publish)」**。
3. 提交后，你的扩展状态会变为 **「正在审核 (In Review)」**。
4. 通常在 **24 ~ 72 小时** 内，你的注册邮箱会收到微软官方发出的通知：
   - 审核通过：状态转为 **「已在市面上 (In Store)」**，并附带公开的 Edge 官方应用商店专属链接！全网用户均可直接搜索下载。
   - 如遇补充说明：微软会明确指出需要补充的细节，按照指示在 Partner Center 修改后重新点击提交即可。
