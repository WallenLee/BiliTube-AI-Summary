// Video Mindmap Studio SidePanel Logic

const API_BASE = "http://127.0.0.1:8765";

let currentActiveTab = null;
let currentSummaryData = null;
let currentSubtitles = [];
let markmapInstance = null;

// DOM Elements
const serviceStatusEl = document.getElementById("service-status");
const videoPlatformEl = document.getElementById("video-platform");
const videoTitleEl = document.getElementById("video-title");
const videoUrlEl = document.getElementById("video-url");

const btnSummarize = document.getElementById("btn-summarize");
const btnSaveSummary = document.getElementById("btn-save-summary");
const btnOpenLocalDoc = document.getElementById("btn-open-local-doc");
const btnClearAll = document.getElementById("btn-clear-all");
const btnOpenObsidian = document.getElementById("btn-open-obsidian");

// Export Modal Elements
const exportModal = document.getElementById("export-modal");
const btnCloseExport = document.getElementById("btn-close-export");
const btnCancelExport = document.getElementById("btn-cancel-export");
const btnConfirmExport = document.getElementById("btn-confirm-export");
const exportFilePreview = document.getElementById("export-file-preview");
const exportDirPreview = document.getElementById("export-dir-preview");
const exportQaCountEl = document.getElementById("export-qa-count");
const exportQaListEl = document.getElementById("export-qa-list");
const exportQaEmptyEl = document.getElementById("export-qa-empty");
const exportQaActionBtns = document.getElementById("export-qa-action-btns");
const btnQaSelectAll = document.getElementById("btn-qa-select-all");
const btnQaDeselectAll = document.getElementById("btn-qa-deselect-all");

const progressContainer = document.getElementById("progress-container");
const progressText = document.getElementById("progress-text");

const emptyStateEl = document.getElementById("empty-state");
const mindmapViewEl = document.getElementById("mindmap-view");
const docViewEl = document.getElementById("doc-view");
const docContentEl = document.getElementById("doc-content");
const markmapSvgEl = document.getElementById("markmap-svg");

// Transcript Elements
const transcriptViewEl = document.getElementById("transcript-view");
const transcriptListEl = document.getElementById("transcript-list");
const transcriptSearchInput = document.getElementById("transcript-search");
const transcriptCountEl = document.getElementById("transcript-count");
const btnCopyTranscript = document.getElementById("btn-copy-transcript");

// Chat & Q&A Elements
const chatViewEl = document.getElementById("chat-view");
const chatMessagesEl = document.getElementById("chat-messages");
const chatWelcomeEl = document.getElementById("chat-welcome");
const chatQuoteBarEl = document.getElementById("chat-quote-bar");
const chatQuoteTextEl = document.getElementById("chat-quote-text");
const btnCancelQuote = document.getElementById("btn-cancel-quote");
const chatInputEl = document.getElementById("chat-input");
const btnSendChat = document.getElementById("btn-send-chat");

// Selection Popover Elements
const selectionPopoverEl = document.getElementById("selection-popover");
const popExplain = document.getElementById("pop-explain");
const popEvidence = document.getElementById("pop-evidence");
const popAsk = document.getElementById("pop-ask");

let chatHistory = [];
let currentQuotedText = "";
let currentSelectedText = "";
let isStreamingChat = false;
let isInteractingWithPopover = false;

// Tabs & Actions
const tabButtons = document.querySelectorAll(".tab-btn");
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const btnResetMap = document.getElementById("btn-reset-map");
const btnCopyMd = document.getElementById("btn-copy-md");

// Settings Modal
const settingsModal = document.getElementById("settings-modal");
const btnSettings = document.getElementById("btn-settings");
const btnCloseSettings = document.getElementById("btn-close-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");
const btnBrowseFolder = document.getElementById("btn-browse-folder");
const cfgSaveDirInput = document.getElementById("cfg-save-dir");
const btnRestartService = document.getElementById("btn-restart-service");
const settingsServiceStatus = document.getElementById("settings-service-status");
const restartHint = document.getElementById("restart-hint");

// Logs Modal Elements
const btnLogs = document.getElementById("btn-logs");
const btnOpenLogsFromSettings = document.getElementById("btn-open-logs-from-settings");
const logsModal = document.getElementById("logs-modal");
const btnCloseLogs = document.getElementById("btn-close-logs");
const btnClearLogs = document.getElementById("btn-clear-logs");
const btnCopyLogs = document.getElementById("btn-copy-logs");
const btnRefreshLogs = document.getElementById("btn-refresh-logs");
const logsBadge = document.getElementById("logs-badge");
const logsBody = document.getElementById("logs-body");
const logsList = document.getElementById("logs-list");
const chkAutoScroll = document.getElementById("chk-auto-scroll");
const logsStatusHint = document.getElementById("logs-status-hint");

// Font Scaling Elements
const fontScaleHud = document.getElementById("font-scale-hud");
const fontScaleText = document.getElementById("font-scale-text");
const cfgFontScale = document.getElementById("cfg-font-scale");
const settingsFontScaleVal = document.getElementById("settings-font-scale-val");
const btnFontDec = document.getElementById("btn-font-dec");
const btnFontInc = document.getElementById("btn-font-inc");
const btnFontReset = document.getElementById("btn-font-reset");

let logPollTimer = null;
let lastLogText = "";

// --- Session Persistence Management ---
let activeTabName = "mindmap-view";
const SESSION_STORAGE_KEY = "BILITUBE_ACTIVE_SESSION";
const storageArea = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.session) 
  ? chrome.storage.session 
  : (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome.storage.local : null);

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function saveSessionState() {
  try {
    if (!storageArea) return;
    if (!currentSummaryData) {
      await storageArea.remove(SESSION_STORAGE_KEY);
      return;
    }
    const state = {
      summaryData: currentSummaryData,
      subtitles: currentSubtitles || [],
      chatHistory: chatHistory || [],
      lastActiveTab: activeTabName || "mindmap-view"
    };
    await storageArea.set({ [SESSION_STORAGE_KEY]: state });
  } catch (err) {
    console.warn("Could not save session state:", err);
  }
}

async function clearSessionState() {
  try {
    if (!storageArea) return;
    await storageArea.remove(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear session state:", err);
  }
}

async function restoreSessionState() {
  try {
    if (!storageArea) return false;
    const res = await storageArea.get(SESSION_STORAGE_KEY);
    const state = res ? res[SESSION_STORAGE_KEY] : null;

    if (!state || !state.summaryData || !state.summaryData.markdown) {
      return false;
    }

    currentSummaryData = state.summaryData;
    currentSubtitles = state.subtitles || [];
    chatHistory = state.chatHistory || [];
    activeTabName = state.lastActiveTab || "mindmap-view";

    // 1. Hide empty state
    emptyStateEl.classList.add("hidden");

    // 2. Unhide target pane first so SVG/DOM has real layout dimensions
    mindmapViewEl.classList.add("hidden");
    docViewEl.classList.add("hidden");
    transcriptViewEl.classList.add("hidden");
    chatViewEl.classList.add("hidden");

    if (activeTabName === "mindmap-view") {
      mindmapViewEl.classList.remove("hidden");
    } else if (activeTabName === "doc-view") {
      docViewEl.classList.remove("hidden");
    } else if (activeTabName === "transcript-view") {
      transcriptViewEl.classList.remove("hidden");
    } else if (activeTabName === "chat-view") {
      chatViewEl.classList.remove("hidden");
    }

    // 3. Render Markmap, Document & Subtitles
    renderMarkmap(currentSummaryData.markdown);
    renderDocView(currentSummaryData.markdown);
    renderTranscript(currentSubtitles);

    // 4. Render Chat History
    chatMessagesEl.innerHTML = "";
    if (chatHistory && chatHistory.length > 0) {
      if (chatWelcomeEl) chatWelcomeEl.classList.add("hidden");
      chatHistory.forEach(item => {
        if (item.role === "user") {
          const userMsgEl = document.createElement("div");
          userMsgEl.className = "chat-msg user";

          let rawText = item.text || "";
          let quoteText = "";
          const qMatch = rawText.match(/^\[引用(?:片段)?:\s*"(.*?)"\]\n([\s\S]*)/);
          if (qMatch) {
            quoteText = qMatch[1];
            rawText = qMatch[2];
          }

          let userHtml = "";
          if (quoteText) {
            userHtml += `<div class="chat-quote-tag">引用: "${escapeHtml(quoteText)}"</div>`;
          }
          userHtml += `<div class="chat-content">${escapeHtml(rawText).replace(/\n/g, '<br>')}</div>`;
          userMsgEl.innerHTML = userHtml;
          chatMessagesEl.appendChild(userMsgEl);
        } else if (item.role === "assistant") {
          const assistantMsgEl = document.createElement("div");
          assistantMsgEl.className = "chat-msg assistant";
          const assistantContentEl = document.createElement("div");
          assistantContentEl.className = "chat-content";
          renderChatMarkdown(item.text || "", assistantContentEl, false);
          assistantMsgEl.appendChild(assistantContentEl);
          chatMessagesEl.appendChild(assistantMsgEl);
        }
      });
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    } else {
      if (chatWelcomeEl) chatWelcomeEl.classList.remove("hidden");
    }

    // 5. Show Action Buttons
    btnClearAll.classList.remove("hidden");
    if (currentSummaryData.file_path) {
      btnSaveSummary.classList.add("hidden");
      btnOpenLocalDoc.classList.remove("hidden");
      btnOpenLocalDoc.onclick = () => openSavedLocalDocument(currentSummaryData.file_path);
      if (btnOpenObsidian) {
        btnOpenObsidian.classList.remove("hidden");
        btnOpenObsidian.textContent = "📂 打开本地文档";
        btnOpenObsidian.onclick = () => openSavedLocalDocument(currentSummaryData.file_path);
      }
    } else {
      btnSaveSummary.classList.remove("hidden");
      btnSaveSummary.disabled = false;
      btnSaveSummary.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">保存这篇到本地</span>';
      btnOpenLocalDoc.classList.add("hidden");
      if (btnOpenObsidian) btnOpenObsidian.classList.add("hidden");
    }

    // 6. Switch tab styles & fit markmap
    switchToTab(activeTabName);
    return true;
  } catch (err) {
    console.error("Failed to restore session state:", err);
    return false;
  }
}

// --- 1. Service Health Check ---
async function checkServiceHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
    if (res.ok) {
      serviceStatusEl.textContent = "🟢 调度服务在线";
      serviceStatusEl.className = "status-badge online";
      if (settingsServiceStatus) {
        settingsServiceStatus.textContent = "● 服务正常在线";
        settingsServiceStatus.className = "status-badge online";
      }
      return true;
    }
  } catch (e) {
    // Service offline
  }
  serviceStatusEl.textContent = "🔴 调度服务未启动";
  serviceStatusEl.className = "status-badge offline";
  if (settingsServiceStatus) {
    settingsServiceStatus.textContent = "● 服务未启动";
    settingsServiceStatus.className = "status-badge offline";
  }
  return false;
}

// --- 2. Active Tab Detection ---
async function detectCurrentVideoTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    currentActiveTab = tab;

    let displayTitle = (tab.title || "未知标题")
      .replace(/_哔哩哔哩_bilibili$/i, '')
      .replace(/ - YouTube$/i, '')
      .trim();

    videoTitleEl.textContent = displayTitle;
    videoUrlEl.textContent = tab.url;

    if (tab.url.includes("bilibili.com")) {
      videoPlatformEl.textContent = "Bilibili 视频";
      videoPlatformEl.style.background = "#fb7299";
      btnSummarize.disabled = false;
    } else if (tab.url.includes("youtube.com") || tab.url.includes("youtu.be")) {
      videoPlatformEl.textContent = "YouTube 视频";
      videoPlatformEl.style.background = "#ff0000";
      btnSummarize.disabled = false;
    } else {
      videoPlatformEl.textContent = "当前网页";
      videoPlatformEl.style.background = "#64748b";
      btnSummarize.disabled = false;
    }

    // Query fresh in-DOM video info to avoid any SPA navigation title lag
    try {
      chrome.tabs.sendMessage(tab.id, { action: "GET_VIDEO_INFO" }, (resp) => {
        if (!chrome.runtime.lastError && resp && resp.title) {
          videoTitleEl.textContent = resp.title;
          if (resp.url) {
            videoUrlEl.textContent = resp.url;
            currentActiveTab.url = resp.url;
          }
          currentActiveTab.title = resp.title;
        }
      });
    } catch (e) {}

    // Check if current displayed summary belongs to a different video
    checkStaleSummaryMismatch();
  } catch (err) {
    console.error("Tab detection error:", err);
  }
}

function checkStaleSummaryMismatch() {
  if (!currentSummaryData || !currentActiveTab || !currentActiveTab.url) return;
  const currentUrl = currentActiveTab.url.split('?')[0].split('#')[0];
  const summaryUrl = (currentSummaryData.url || "").split('?')[0].split('#')[0];

  // If URL clearly belongs to another video
  if (summaryUrl && currentUrl && !currentUrl.includes(summaryUrl) && !summaryUrl.includes(currentUrl)) {
    // Show polite notice badge on top of views
    let mismatchNotice = document.getElementById("ai-mismatch-notice");
    if (!mismatchNotice) {
      mismatchNotice = document.createElement("div");
      mismatchNotice.id = "ai-mismatch-notice";
      mismatchNotice.style.cssText = `
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 8px;
        padding: 8px 12px;
        margin: 10px 0 6px 0;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;
      const mainContainer = document.querySelector(".view-container") || document.body;
      mainContainer.parentElement.insertBefore(mismatchNotice, mainContainer);
    }
    mismatchNotice.innerHTML = `
      <span>💡 当前展示为上一篇视频的总结记录。点击上方<b>【✨ 一键总结】</b>开始分析当前视频。</span>
      <button id="btn-dismiss-mismatch" style="background:none;border:none;color:#f59e0b;cursor:pointer;font-size:14px;padding:0 4px;">×</button>
    `;
    mismatchNotice.classList.remove("hidden");
    const btnDismiss = document.getElementById("btn-dismiss-mismatch");
    if (btnDismiss) {
      btnDismiss.onclick = () => mismatchNotice.classList.add("hidden");
    }
  } else {
    const mismatchNotice = document.getElementById("ai-mismatch-notice");
    if (mismatchNotice) mismatchNotice.classList.add("hidden");
  }
}

// --- 3. Format Helpers ---
function formatSeconds(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- 4. Markdown to Markmap Tree Parser ---
function markdownToMarkmapTree(markdownText) {
  const lines = markdownText.split("\n").filter(l => l.trim().length > 0);
  const root = { content: "核心导图", children: [] };
  const stack = [{ node: root, depth: -1 }];
  let lastTimestamp = "";

  for (const rawLine of lines) {
    let line = rawLine.trimEnd();
    let depth = 0;
    let content = "";

    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      depth = hMatch[1].length * 2 - 2;
      content = hMatch[2].trim();
      // On new major sections, allow timestamp restart
      lastTimestamp = "";
    } else {
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
      if (listMatch) {
        depth = 10 + Math.floor(listMatch[1].length / 2) * 2;
        content = listMatch[3].trim();
      } else {
        continue;
      }
    }

    // Clean up any stray raw HTML tags if present in input
    content = content.replace(/<a\s+[^>]*href=["']seek:(\d+)["'][^>]*>.*?(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?).*?<\/a>/gi, '[$2](seek:$1)');
    content = content.replace(/<a\s+class=["']timestamp-pill["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

    // Extract and format timestamp [MM:SS](seek:123) into clean clickable links
    let timePillHtml = "";
    const tsMatch = content.match(/\[(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\]\(seek:(\d+)\)/);
    if (tsMatch) {
      const timeStr = tsMatch[1];
      const sec = tsMatch[2];
      // Deduplicate consecutive identical timestamps on child nodes (e.g. repeated 00:00)
      if (depth > 0 && timeStr === lastTimestamp) {
        content = content.replace(tsMatch[0], '').trim();
      } else {
        lastTimestamp = timeStr;
        timePillHtml = `<a class="timestamp-pill" href="seek:${sec}" title="点击跳转至 ${timeStr}">⏱️ ${timeStr}</a>`;
        content = content.replace(tsMatch[0], '').trim();
      }
    }

    // Convert markdown bold **text** to <strong>text</strong>
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Remove stray outer quotes
    content = content.replace(/^["'“”\s]+|["'“”\s]+$/g, '');

    // Add node ask button for interactive Q&A
    const nodeTextPure = content.replace(/<[^>]+>/g, '').replace(/["']/g, '').trim();
    if (nodeTextPure && depth >= 0) {
      const safeTitle = nodeTextPure.slice(0, 30);
      content = `${content} ${timePillHtml} <a class="node-ask-btn" data-node-title="${safeTitle}" title="针对此分支向 AI 提问">💬</a>`;
    } else {
      content = `${content} ${timePillHtml}`;
    }

    const node = { content, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }

  return root.children.length === 1 ? root.children[0] : root;
}

// --- 5. Renderers ---
function renderMarkmap(rawMarkdown) {
  let mapContent = rawMarkdown;
  const match = rawMarkdown.match(/```markmap([\s\S]*?)```/);
  if (match) {
    mapContent = match[1].trim();
  } else {
    mapContent = rawMarkdown.split("\n")
      .filter(l => l.trim().startsWith("#") || l.trim().startsWith("-") || l.trim().startsWith("*"))
      .join("\n");
  }

  const tree = markdownToMarkmapTree(mapContent);

  if (window.markmap && window.markmap.Markmap) {
    while (markmapSvgEl.firstChild) {
      markmapSvgEl.removeChild(markmapSvgEl.firstChild);
    }
    markmapInstance = window.markmap.Markmap.create(markmapSvgEl, {
      duration: 250,
      color: (node) => {
        const colors = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#f97316"];
        return colors[node.state.depth % colors.length];
      }
    }, tree);

    setTimeout(() => {
      if (markmapInstance && markmapInstance.fit) {
        markmapInstance.fit();
      }
    }, 200);
  }
}

function renderDocView(rawMarkdown) {
  if (!rawMarkdown) {
    docContentEl.innerHTML = "";
    return;
  }

  // 1. In Doc View, unwrap ```markmap code blocks so they render as standard headings & lists rather than code blocks!
  let cleanMd = rawMarkdown.replace(/```markmap\s*([\s\S]*?)```/g, (match, code) => {
    let lines = code.trim().split("\n");
    // Strip redundant top-level # Title inside markmap block since document already has a title
    if (lines.length > 0 && lines[0].startsWith("# ")) {
      lines.shift();
    }
    return "\n" + lines.join("\n") + "\n";
  });

  // 2. Strip any backticks around timestamp links
  cleanMd = cleanMd.replace(/`(\[(?:⏱️\s*)?\d{1,2}:\d{2}(?::\d{2})?\]\(seek:\d+\))`?/g, '$1');

  // 3. Clean up any raw HTML tags that might have leaked into Markdown
  cleanMd = cleanMd.replace(/<a\s+[^>]*href=["']seek:(\d+)["'][^>]*>.*?(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?).*?<\/a>/gi, '[$2](seek:$1)');
  cleanMd = cleanMd.replace(/<a\s+class=["']timestamp-pill["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

  let html = "";
  if (window.marked) {
    html = window.marked.parse(cleanMd);
  } else {
    html = cleanMd;
  }

  // 4. Convert seek links into clickable timestamp-pill anchors in HTML
  html = html.replace(
    /<a\s+href=["']seek:(\d+)["'][^>]*>(?:⏱️\s*)?([^<]+)<\/a>/gi,
    '<a class="timestamp-pill" href="seek:$1" title="点击跳转原片对应时间">⏱️ $2</a>'
  );
  html = html.replace(
    /\[(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\]\(seek:(\d+)\)/g,
    '<a class="timestamp-pill" href="seek:$2" title="点击跳转原片对应时间">⏱️ $1</a>'
  );

  docContentEl.innerHTML = html;
}

function renderTranscript(subtitles) {
  currentSubtitles = subtitles || [];
  transcriptListEl.innerHTML = "";
  transcriptSearchInput.value = "";

  if (!currentSubtitles || currentSubtitles.length === 0) {
    transcriptCountEl.textContent = "共 0 句";
    transcriptListEl.innerHTML = '<div class="transcript-empty">此视频无字幕文字流</div>';
    return;
  }

  transcriptCountEl.textContent = `共 ${currentSubtitles.length} 句`;

  const fragment = document.createDocumentFragment();
  currentSubtitles.forEach((item) => {
    const fromSec = item.from || 0;
    const timeStr = formatSeconds(fromSec);
    const content = item.content || "";

    const row = document.createElement("div");
    row.className = "transcript-row";
    row.setAttribute("data-text", content.toLowerCase());

    const pill = document.createElement("a");
    pill.className = "timestamp-pill";
    pill.href = `seek:${Math.floor(fromSec)}`;
    pill.textContent = `⏱️ ${timeStr}`;

    const textSpan = document.createElement("span");
    textSpan.className = "transcript-text";
    textSpan.textContent = content;

    row.appendChild(pill);
    row.appendChild(textSpan);
    fragment.appendChild(row);
  });

  transcriptListEl.appendChild(fragment);
}

// Subtitle Search Filter
transcriptSearchInput.addEventListener("input", (e) => {
  const kw = e.target.value.trim().toLowerCase();
  const rows = transcriptListEl.querySelectorAll(".transcript-row");
  let visibleCount = 0;

  rows.forEach((row) => {
    const text = row.getAttribute("data-text") || "";
    if (!kw || text.includes(kw)) {
      row.classList.remove("hidden");
      visibleCount++;
    } else {
      row.classList.add("hidden");
    }
  });

  transcriptCountEl.textContent = kw ? `匹配 ${visibleCount} / ${rows.length} 句` : `共 ${rows.length} 句`;
});

// Copy All Subtitles
btnCopyTranscript.addEventListener("click", () => {
  if (!currentSubtitles || currentSubtitles.length === 0) return;
  const fullText = currentSubtitles
    .map(s => `[${formatSeconds(s.from)}] ${s.content}`)
    .join("\n");

  navigator.clipboard.writeText(fullText).then(() => {
    btnCopyTranscript.textContent = "✅ 已复制全部字幕！";
    setTimeout(() => { btnCopyTranscript.textContent = "📋 复制全部字幕"; }, 2000);
  });
});

// --- 6. Video Seek Dispatcher ---
function seekVideo(seconds) {
  if (!currentActiveTab || !currentActiveTab.id) return;
  chrome.tabs.sendMessage(currentActiveTab.id, {
    action: "SEEK",
    seconds: parseFloat(seconds)
  }).catch((err) => {
    console.warn("Could not send seek message to tab:", err);
  });
}

document.addEventListener("click", (e) => {
  // 1. Mindmap node ask button
  const askBtn = e.target.closest(".node-ask-btn");
  if (askBtn) {
    e.preventDefault();
    e.stopPropagation();
    const nodeTitle = askBtn.getAttribute("data-node-title");
    if (nodeTitle) {
      switchToTab("chat-view");
      sendChatMessage(`请结合原视频详细解析思维导图分支【${nodeTitle}】的论述细节与背景机制。`, nodeTitle);
    }
    return;
  }

  // 2. Video Seek Dispatcher
  const target = e.target.closest("a");
  if (!target) return;

  const href = target.getAttribute("href") || "";
  if (href.startsWith("seek:")) {
    e.preventDefault();
    const sec = href.replace("seek:", "");
    seekVideo(sec);
    return;
  }

  // Also support URLs with ?t=123 or &t=123s
  const tMatch = href.match(/[?&]t=(\d+)s?/);
  if (tMatch) {
    e.preventDefault();
    seekVideo(tMatch[1]);
    return;
  }
});

// --- 7. Task Execution & SSE Streaming ---
async function startSummarize() {
  const isHealthy = await checkServiceHealth();
  if (!isHealthy) {
    alert("请先双击运行 backend 目录下的 start_server.bat 启动本地调度服务！");
    return;
  }

  // Always re-query the currently active tab first to guarantee 100% real-time accuracy across tabs and SPA
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) {
      currentActiveTab = activeTab;
    }
  } catch (e) {}

  if (!currentActiveTab || !currentActiveTab.url) {
    alert("未获取到当前标签页视频链接，请刷新重试。");
    return;
  }

  btnSummarize.disabled = true;
  btnSaveSummary.classList.add("hidden");
  btnOpenLocalDoc.classList.add("hidden");
  btnClearAll.classList.add("hidden");
  progressContainer.classList.remove("hidden");
  progressText.textContent = "⚡ 正在尝试从当前网页直接捕获官方/AI字幕...";

  // Clear previous session storage and immediately hide all old content to eliminate any cross-video visual contamination
  currentSummaryData = null;
  currentSubtitles = [];
  chatHistory = [];
  await clearSessionState();

  mindmapViewEl.classList.add("hidden");
  docViewEl.classList.add("hidden");
  transcriptViewEl.classList.add("hidden");
  chatViewEl.classList.add("hidden");
  emptyStateEl.classList.add("hidden");
  const mismatchNotice = document.getElementById("ai-mismatch-notice");
  if (mismatchNotice) mismatchNotice.classList.add("hidden");

  let preExtractedSubtitles = null;
  let preTitle = currentActiveTab.title || "";
  let subSource = "";

  // 1. Try direct in-browser extraction first (0.2s)
  try {
    const tabRes = await new Promise((resolve) => {
      chrome.tabs.sendMessage(currentActiveTab.id, { action: "EXTRACT_SUBTITLES_DIRECT" }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          resolve(null);
        } else {
          resolve(resp);
        }
      });
      setTimeout(() => resolve(null), 1500);
    });

    if (tabRes && tabRes.data && tabRes.data.title) {
      preTitle = tabRes.data.title;
      videoTitleEl.textContent = preTitle;
    }

    if (tabRes && tabRes.data && tabRes.data.rejected) {
      if (tabRes.data.reason === "duration_mismatch" || tabRes.data.reason === "duration_incomplete") {
        progressText.textContent = "⚡ 检测到在线字幕时长与当前视频不匹配(前序视频缓存)，自动切换至服务端深度通道...";
      } else {
        progressText.textContent = "⚡ 检测到在线字幕主要为纯音乐/占位标签，自动切换至服务端深度通道...";
      }
      preExtractedSubtitles = null;
    } else if (tabRes && tabRes.status === "success" && tabRes.data && tabRes.data.subtitles && tabRes.data.subtitles.length > 0) {
      // Defense: verify duration in sidepanel as well
      const videoDur = tabRes.data.videoDuration || 0;
      let maxSubTime = 0;
      for (const s of tabRes.data.subtitles) {
        if (s.to > maxSubTime) maxSubTime = s.to;
      }

      if (videoDur > 0 && maxSubTime > (videoDur * 1.25 + 10)) {
        console.warn(`[SidePanel] Discarding stale subtitles: maxSubTime ${maxSubTime}s > videoDur ${videoDur}s`);
        preExtractedSubtitles = null;
        progressText.textContent = "⚡ 网页字幕为前序视频缓存残留，已自动转入服务端通道重新转写...";
      } else {
        preExtractedSubtitles = tabRes.data.subtitles;
        if (tabRes.data.title) {
          preTitle = tabRes.data.title;
          videoTitleEl.textContent = preTitle;
        }
        subSource = tabRes.data.sub_source || "browser_direct";
        progressText.textContent = `⚡ 网页官方字幕捕获成功 (共 ${preExtractedSubtitles.length} 句)，跳过下载直接总结...`;
      }
    }
  } catch (e) {
    console.warn("Direct subtitle probe fallback:", e);
  }

  try {
    const payload = {
      url: currentActiveTab.url,
      title: preTitle
    };
    if (preExtractedSubtitles && preExtractedSubtitles.length > 0) {
      payload.pre_extracted_subtitles = preExtractedSubtitles;
      payload.sub_source = subSource;
    }

    const res = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const initData = await res.json();
    const taskId = initData.task_id;

    const eventSource = new EventSource(`${API_BASE}/api/stream/${taskId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          progressText.textContent = data.message;
        }

        if (data.status === "completed") {
          eventSource.close();
          btnSummarize.disabled = false;
          progressContainer.classList.add("hidden");

          if (!data.url && currentActiveTab) {
            data.url = currentActiveTab.url;
          }
          currentSummaryData = data;
          emptyStateEl.classList.add("hidden");
          mindmapViewEl.classList.remove("hidden");
          docViewEl.classList.add("hidden");
          transcriptViewEl.classList.add("hidden");
          chatViewEl.classList.add("hidden");

          // Reset chat state for new video
          chatHistory = [];
          chatMessagesEl.innerHTML = "";
          if (chatWelcomeEl) chatWelcomeEl.classList.remove("hidden");
          clearQuote();

          // Reset tab buttons to mindmap active
          activeTabName = "mindmap-view";
          tabButtons.forEach(b => b.classList.remove("active"));
          tabButtons[0].classList.add("active");

          // Render Markmap, Document & Subtitles
          renderMarkmap(data.markdown);
          renderDocView(data.markdown);
          renderTranscript(data.subtitles);

          // Save session state to storage
          saveSessionState();

          // Show Action Buttons
          btnClearAll.classList.remove("hidden");

          if (data.file_path) {
            // Auto-saved
            btnSaveSummary.classList.add("hidden");
            btnOpenLocalDoc.classList.remove("hidden");
            btnOpenLocalDoc.onclick = () => openSavedLocalDocument(data.file_path);
            if (btnOpenObsidian) {
              btnOpenObsidian.classList.remove("hidden");
              btnOpenObsidian.textContent = "📂 打开本地文档";
              btnOpenObsidian.onclick = () => openSavedLocalDocument(data.file_path);
            }
          } else {
            // Manual Save Mode
            btnSaveSummary.classList.remove("hidden");
            btnSaveSummary.disabled = false;
            btnSaveSummary.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">保存这篇到本地</span>';
            btnOpenLocalDoc.classList.add("hidden");
            if (btnOpenObsidian) btnOpenObsidian.classList.add("hidden");
          }
        } else if (data.status === "error") {
          eventSource.close();
          btnSummarize.disabled = false;
          progressContainer.classList.add("hidden");
          alert("总结失败: " + data.message);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      btnSummarize.disabled = false;
      progressContainer.classList.add("hidden");
    };

  } catch (err) {
    btnSummarize.disabled = false;
    progressContainer.classList.add("hidden");
    alert("请求本地服务失败: " + err.message);
  }
}

// --- 7.5. Document Export & Q&A Selection ---
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractQAPairsFromHistory() {
  const pairs = [];
  if (!chatHistory || chatHistory.length === 0) return pairs;
  for (let i = 0; i < chatHistory.length; i++) {
    const item = chatHistory[i];
    if (item.role === "user") {
      let answer = "";
      if (i + 1 < chatHistory.length && chatHistory[i + 1].role === "assistant") {
        answer = chatHistory[i + 1].text || "";
      }
      pairs.push({
        id: pairs.length,
        question: item.text || "",
        answer: answer
      });
    }
  }
  return pairs;
}

async function openSavedLocalDocument(filePath) {
  const targetPath = filePath || (currentSummaryData && currentSummaryData.file_path);
  if (!targetPath) {
    alert("未找到已保存的文档路径");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/open-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: targetPath })
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("Open file locally fallback:", err);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(targetPath);
      alert(`已成功复制文件完整路径到剪贴板：\n${targetPath}\n\n您可直接在本地默认编辑器中打开。`);
    } else {
      alert(`文档已保存至：\n${targetPath}`);
    }
  }
}

async function openExportModal() {
  if (!currentSummaryData || !currentSummaryData.markdown) return;

  const qaPairs = extractQAPairsFromHistory();
  const rawTitle = currentSummaryData.title || (currentActiveTab && currentActiveTab.title) || "视频总结";

  // Format date and clean file name
  const today = new Date().toISOString().slice(0, 10);
  const cleanTitle = rawTitle.replace(/[\\/*?:"<>|]/g, '').trim();
  if (exportFilePreview) exportFilePreview.textContent = `[${today}] ${cleanTitle}.md`;

  // Fetch configured save directory
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) {
      const cfg = await res.json();
      if (exportDirPreview) exportDirPreview.textContent = cfg.save_directory || "系统默认文档目录 (Documents/VideoSummaries)";
    }
  } catch (e) {
    if (exportDirPreview) exportDirPreview.textContent = "系统默认文档目录";
  }

  // Populate Q&A List
  if (exportQaListEl) exportQaListEl.innerHTML = "";
  if (qaPairs.length === 0) {
    if (exportQaEmptyEl) exportQaEmptyEl.classList.remove("hidden");
    if (exportQaActionBtns) exportQaActionBtns.classList.add("hidden");
    if (exportQaCountEl) exportQaCountEl.textContent = "0 组问答";
  } else {
    if (exportQaEmptyEl) exportQaEmptyEl.classList.add("hidden");
    if (exportQaActionBtns) exportQaActionBtns.classList.remove("hidden");
    if (exportQaCountEl) exportQaCountEl.textContent = `共 ${qaPairs.length} 组问答`;

    qaPairs.forEach((pair, idx) => {
      const itemEl = document.createElement("label");
      itemEl.className = "export-qa-item";
      itemEl.innerHTML = `
        <input type="checkbox" class="export-qa-checkbox" data-index="${idx}" checked>
        <div class="export-qa-content">
          <div class="export-qa-q">❓ ${escapeHtml(pair.question)}</div>
          <div class="export-qa-a">🤖 ${escapeHtml(pair.answer.slice(0, 75))}${pair.answer.length > 75 ? '...' : ''}</div>
        </div>
      `;
      if (exportQaListEl) exportQaListEl.appendChild(itemEl);
    });
  }

  if (exportModal) exportModal.classList.remove("hidden");
}

async function confirmExportMarkdown() {
  if (!currentSummaryData || !currentSummaryData.markdown) return;

  const qaPairs = extractQAPairsFromHistory();
  const checkboxes = exportQaListEl ? exportQaListEl.querySelectorAll(".export-qa-checkbox:checked") : [];
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute("data-index"), 10));

  let finalMarkdown = currentSummaryData.markdown;

  // Append selected Q&A
  if (selectedIndices.length > 0) {
    const qaSections = [];
    selectedIndices.forEach((idx, qIdx) => {
      const pair = qaPairs[idx];
      if (pair) {
        qaSections.push(`### ❓ Q${qIdx + 1}：${pair.question}\n\n> **🤖 AI 伴读解答**：\n>\n> ${pair.answer.replace(/\n/g, '\n> ')}`);
      }
    });

    finalMarkdown += `\n\n---\n\n## 💬 伴读延伸问答记录\n\n${qaSections.join('\n\n')}\n`;
  }

  if (btnConfirmExport) {
    btnConfirmExport.disabled = true;
    btnConfirmExport.innerHTML = '<span class="btn-icon">⏳</span> 正在保存...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/save-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: finalMarkdown,
        title: currentSummaryData.title || (currentActiveTab && currentActiveTab.title) || "视频总结"
      })
    });

    const data = await res.json();
    if (res.ok && data.status === "ok") {
      if (exportModal) exportModal.classList.add("hidden");
      if (currentSummaryData) {
        currentSummaryData.file_path = data.file_path;
        currentSummaryData.obsidian_uri = data.obsidian_uri;
        saveSessionState();
      }

      // Switch buttons to "Open Local Doc"
      btnSaveSummary.classList.add("hidden");
      if (btnOpenLocalDoc) {
        btnOpenLocalDoc.classList.remove("hidden");
        btnOpenLocalDoc.onclick = () => openSavedLocalDocument(data.file_path);
      }

      if (btnOpenObsidian) {
        btnOpenObsidian.classList.remove("hidden");
        btnOpenObsidian.textContent = "📂 打开本地文档";
        btnOpenObsidian.onclick = () => openSavedLocalDocument(data.file_path);
      }

      alert(`✅ 成功保存为 Markdown 文档！\n\n文件路径：\n${data.file_path}${selectedIndices.length > 0 ? `\n（已包含 ${selectedIndices.length} 组伴读问答记录）` : ''}`);
    } else {
      alert("保存失败: " + (data.message || "未知错误"));
    }
  } catch (err) {
    alert("保存出错: " + err.message);
  } finally {
    if (btnConfirmExport) {
      btnConfirmExport.disabled = false;
      btnConfirmExport.innerHTML = '<span class="btn-icon">💾</span> 确认保存文档';
    }
  }
}

// Export Modal Event Bindings
btnSaveSummary.addEventListener("click", openExportModal);
if (btnCloseExport) btnCloseExport.addEventListener("click", () => exportModal.classList.add("hidden"));
if (btnCancelExport) btnCancelExport.addEventListener("click", () => exportModal.classList.add("hidden"));
if (btnConfirmExport) btnConfirmExport.addEventListener("click", confirmExportMarkdown);

if (btnQaSelectAll && exportQaListEl) {
  btnQaSelectAll.addEventListener("click", () => {
    exportQaListEl.querySelectorAll(".export-qa-checkbox").forEach(cb => cb.checked = true);
  });
}
if (btnQaDeselectAll && exportQaListEl) {
  btnQaDeselectAll.addEventListener("click", () => {
    exportQaListEl.querySelectorAll(".export-qa-checkbox").forEach(cb => cb.checked = false);
  });
}
if (btnOpenLocalDoc) {
  btnOpenLocalDoc.addEventListener("click", () => openSavedLocalDocument());
}

// Clear / Reset Handler
btnClearAll.addEventListener("click", async () => {
  if (confirm("确定清空当前总结与思维导图吗？（未保存的内容将不留缓存）")) {
    currentSummaryData = null;
    currentSubtitles = [];

    // Clear contents
    docContentEl.innerHTML = "";
    while (markmapSvgEl.firstChild) {
      markmapSvgEl.removeChild(markmapSvgEl.firstChild);
    }
    transcriptListEl.innerHTML = "";

    // Clear chat
    chatHistory = [];
    chatMessagesEl.innerHTML = "";
    if (chatWelcomeEl) chatWelcomeEl.classList.remove("hidden");
    clearQuote();

    // Clear session storage
    await clearSessionState();

    // Hide panes, reveal empty state
    mindmapViewEl.classList.add("hidden");
    docViewEl.classList.add("hidden");
    transcriptViewEl.classList.add("hidden");
    chatViewEl.classList.add("hidden");
    emptyStateEl.classList.remove("hidden");

    btnSaveSummary.classList.add("hidden");
    if (btnOpenLocalDoc) btnOpenLocalDoc.classList.add("hidden");
    btnClearAll.classList.add("hidden");
    if (btnOpenObsidian) btnOpenObsidian.classList.add("hidden");
  }
});

// --- 8. Tab Switching & Chat Management ---
function switchToTab(targetTab) {
  // Hide selection popover when switching tabs to avoid stray floating UI
  if (selectionPopoverEl) {
    selectionPopoverEl.classList.add("hidden");
    currentSelectedText = "";
  }

  activeTabName = targetTab;
  tabButtons.forEach(b => {
    if (b.getAttribute("data-tab") === targetTab) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });

  mindmapViewEl.classList.add("hidden");
  docViewEl.classList.add("hidden");
  transcriptViewEl.classList.add("hidden");
  chatViewEl.classList.add("hidden");

  if (targetTab === "mindmap-view") {
    mindmapViewEl.classList.remove("hidden");
    if (markmapInstance && markmapInstance.fit) {
      setTimeout(() => markmapInstance.fit(), 100);
    }
  } else if (targetTab === "doc-view") {
    docViewEl.classList.remove("hidden");
  } else if (targetTab === "transcript-view") {
    transcriptViewEl.classList.remove("hidden");
  } else if (targetTab === "chat-view") {
    chatViewEl.classList.remove("hidden");
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    setTimeout(() => chatInputEl.focus(), 80);
  }

  if (currentSummaryData) {
    saveSessionState();
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    switchToTab(targetTab);
  });
});

// Global Theme Toggle (Dark / Light) with Guaranteed Multi-Layer Persistence
const THEME_STORAGE_KEY = "BILITUBE_THEME_MODE";
let currentTheme = "dark";

function applyTheme(themeName) {
  currentTheme = themeName === "light" ? "light" : "dark";
  if (currentTheme === "light") {
    document.body.classList.add("light-theme");
    if (btnThemeToggle) {
      btnThemeToggle.textContent = "☀️";
      btnThemeToggle.title = "当前为浅色主题 (点击切回深色)";
    }
  } else {
    document.body.classList.remove("light-theme");
    if (btnThemeToggle) {
      btnThemeToggle.textContent = "🌓";
      btnThemeToggle.title = "当前为深色主题 (点击切换浅色)";
    }
  }

  // Layer 1: Synchronous localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  } catch (e) {}

  // Layer 2: Official Chrome Extension storage (guaranteed across browser restarts)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: currentTheme });
    } catch (e) {}
  }
}

function initTheme() {
  let savedTheme = "dark";
  // 1. Fast synchronous restore to prevent initial flashing
  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  } catch (e) {}
  applyTheme(savedTheme);

  // 2. Guaranteed restore from chrome.storage.local (restarts / profile restores)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([THEME_STORAGE_KEY], (res) => {
      if (res && res[THEME_STORAGE_KEY] && res[THEME_STORAGE_KEY] !== currentTheme) {
        applyTheme(res[THEME_STORAGE_KEY]);
      }
    });
  }
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    applyTheme(currentTheme === "light" ? "dark" : "light");
  });
}

// Global Stepless Font Scaling with Ctrl + Mouse Wheel & Guaranteed Multi-Layer Persistence
const FONT_SCALE_STORAGE_KEY = "BILITUBE_FONT_SCALE";
const MIN_FONT_SCALE = 0.75;
const MAX_FONT_SCALE = 2.0;
let currentFontScale = 1.0;
let hudTimeout = null;
let backendFontSyncTimer = null;

function showFontScaleHud(percentStr) {
  if (!fontScaleHud || !fontScaleText) return;
  fontScaleText.textContent = `字号: ${percentStr}`;
  fontScaleHud.classList.remove("hidden");
  if (hudTimeout) clearTimeout(hudTimeout);
  hudTimeout = setTimeout(() => {
    fontScaleHud.classList.add("hidden");
  }, 1200);
}

function syncFontScaleToBackend(scale) {
  if (backendFontSyncTimer) clearTimeout(backendFontSyncTimer);
  backendFontSyncTimer = setTimeout(async () => {
    try {
      await fetch(`${API_BASE}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ font_scale: scale, theme_mode: currentTheme })
      });
    } catch (e) {}
  }, 1000);
}

function applyFontScale(scale, showHud = true) {
  currentFontScale = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Math.round(scale * 100) / 100));
  document.documentElement.style.setProperty("--font-scale", currentFontScale);

  const percent = Math.round(currentFontScale * 100);
  const percentStr = `${percent}%`;

  if (cfgFontScale) cfgFontScale.value = percent;
  if (settingsFontScaleVal) settingsFontScaleVal.textContent = percentStr;

  if (showHud) {
    showFontScaleHud(percentStr);
  }

  // Layer 1: Synchronous localStorage cache (immediate 0ms restoration)
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, currentFontScale.toString());
  } catch (e) {}

  // Layer 2: Official Chrome Extension storage (guaranteed survival across browser restarts)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.set({ [FONT_SCALE_STORAGE_KEY]: currentFontScale });
    } catch (e) {}
  }

  // Layer 3: Backend disk config persistence
  syncFontScaleToBackend(currentFontScale);

  // Trigger markmap layout refit if active
  if (markmapInstance && markmapViewEl && !markmapViewEl.classList.contains("hidden")) {
    if (window._markmapFitTimer) clearTimeout(window._markmapFitTimer);
    window._markmapFitTimer = setTimeout(() => {
      try {
        if (markmapInstance.fit) markmapInstance.fit();
      } catch (e) {}
    }, 200);
  }
}

function initFontScale() {
  let saved = "1.0";
  // 1. Immediate sync restore from localStorage
  try {
    saved = localStorage.getItem(FONT_SCALE_STORAGE_KEY) || "1.0";
  } catch (e) {}
  const scale = parseFloat(saved) || 1.0;
  applyFontScale(scale, false);

  // 2. Guaranteed async restore from chrome.storage.local across browser restarts
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([FONT_SCALE_STORAGE_KEY], (res) => {
      if (res && res[FONT_SCALE_STORAGE_KEY]) {
        const localScale = parseFloat(res[FONT_SCALE_STORAGE_KEY]);
        if (!isNaN(localScale) && localScale !== currentFontScale) {
          applyFontScale(localScale, false);
        }
      }
    });
  }
}

// Wheel listener on window: Ctrl + Mouse Wheel for stepless continuous scaling
window.addEventListener("wheel", (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const step = 0.04;
    const delta = e.deltaY < 0 ? step : -step;
    applyFontScale(currentFontScale + delta, true);
  }
}, { passive: false });

// Keyboard listener: Ctrl + 0 (Reset), Ctrl + Plus/Minus
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "0" || e.code === "Digit0" || e.code === "Numpad0") {
      e.preventDefault();
      applyFontScale(1.0, true);
    } else if (e.key === "=" || e.key === "+" || e.code === "Equal" || e.code === "NumpadAdd") {
      e.preventDefault();
      applyFontScale(currentFontScale + 0.05, true);
    } else if (e.key === "-" || e.key === "_" || e.code === "Minus" || e.code === "NumpadSubtract") {
      e.preventDefault();
      applyFontScale(currentFontScale - 0.05, true);
    }
  }
});

// Click or double click HUD to quickly reset to 100%
if (fontScaleHud) {
  fontScaleHud.addEventListener("click", () => {
    applyFontScale(1.0, true);
  });
}

// Settings modal buttons & range slider
if (cfgFontScale) {
  cfgFontScale.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value) / 100;
    applyFontScale(val, true);
  });
}
if (btnFontDec) {
  btnFontDec.addEventListener("click", () => {
    applyFontScale(currentFontScale - 0.05, true);
  });
}
if (btnFontInc) {
  btnFontInc.addEventListener("click", () => {
    applyFontScale(currentFontScale + 0.05, true);
  });
}
if (btnFontReset) {
  btnFontReset.addEventListener("click", () => {
    applyFontScale(1.0, true);
  });
}

// Reset Map
btnResetMap.addEventListener("click", () => {
  if (markmapInstance && markmapInstance.fit) {
    markmapInstance.fit();
  }
});

// Copy Markdown
btnCopyMd.addEventListener("click", () => {
  if (currentSummaryData && currentSummaryData.markdown) {
    // Sanitize any raw HTML tag leaks before copying to clipboard
    let cleanMd = currentSummaryData.markdown
      .replace(/<a\s+[^>]*href=["']seek:(\d+)["'][^>]*>.*?(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?).*?<\/a>/gi, '[$2](seek:$1)')
      .replace(/<a\s+class=["']timestamp-pill["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');
    navigator.clipboard.writeText(cleanMd).then(() => {
      btnCopyMd.textContent = "✅ 已复制到剪贴板！";
      setTimeout(() => { btnCopyMd.textContent = "📋 复制 Markdown"; }, 2000);
    });
  }
});

// --- 9. Chat, Q&A & Floating Selection Popover ---

// Quote Management
function setQuote(text) {
  currentQuotedText = (text || "").trim();
  if (currentQuotedText) {
    chatQuoteTextEl.textContent = currentQuotedText;
    chatQuoteBarEl.classList.remove("hidden");
  } else {
    clearQuote();
  }
}

function clearQuote() {
  currentQuotedText = "";
  chatQuoteTextEl.textContent = "";
  chatQuoteBarEl.classList.add("hidden");
  chatInputEl.placeholder = "输入您对视频的疑问 (Enter 发送，Shift+Enter 换行)...";
}

if (btnCancelQuote) {
  btnCancelQuote.addEventListener("click", clearQuote);
}

// Floating Selection Popover Logic (划词提问 - 全局支持：完整总结、字幕原文、伴读答疑、思维导图)
function handleSelectionChange() {
  if (isInteractingWithPopover) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    if (!isInteractingWithPopover && selectionPopoverEl) {
      selectionPopoverEl.classList.add("hidden");
      currentSelectedText = "";
    }
    return;
  }

  const range = sel.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const container = commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentElement;

  if (!container) {
    if (selectionPopoverEl) selectionPopoverEl.classList.add("hidden");
    currentSelectedText = "";
    return;
  }

  // Never trigger if selecting inside input, textarea, buttons, toolbar controls, modal, or popover itself
  if (container.closest('input, textarea, button, #selection-popover, .toolbar, .transcript-toolbar, .doc-actions-bar, .chat-input-wrapper, #settings-modal')) {
    if (selectionPopoverEl) selectionPopoverEl.classList.add("hidden");
    currentSelectedText = "";
    return;
  }

  // Ensure selection is inside one of the content panes (完整总结、字幕原文、伴读答疑、思维导图)
  const targetPane = container.closest('#doc-content, #transcript-list, #chat-messages, .markmap-wrapper, .markdown-body');
  if (!targetPane) {
    if (selectionPopoverEl) selectionPopoverEl.classList.add("hidden");
    currentSelectedText = "";
    return;
  }

  // Ensure target pane is actually visible (not in a hidden tab)
  const parentTabPane = targetPane.closest('.tab-pane');
  if (parentTabPane && parentTabPane.classList.contains('hidden')) {
    if (selectionPopoverEl) selectionPopoverEl.classList.add("hidden");
    currentSelectedText = "";
    return;
  }

  const text = sel.toString().replace(/\r\n/g, '\n').trim();
  if (text.length < 2) {
    if (selectionPopoverEl) selectionPopoverEl.classList.add("hidden");
    currentSelectedText = "";
    return;
  }

  currentSelectedText = text;

  // Unhide first so dimensions can be measured accurately
  selectionPopoverEl.classList.remove("hidden");

  // Selection bounding box in viewport coordinates
  const rect = range.getBoundingClientRect();

  // If selection is collapsed or completely scrolled out of view, hide popover
  if (!rect || (rect.width === 0 && rect.height === 0) || rect.bottom < 0 || rect.top > window.innerHeight) {
    selectionPopoverEl.classList.add("hidden");
    return;
  }

  const popoverRect = selectionPopoverEl.getBoundingClientRect();
  const popoverWidth = popoverRect.width || 230;
  const popoverHeight = popoverRect.height || 36;

  // Horizontal calculation: Center above selection
  const selCenterX = rect.left + (rect.width / 2);
  let left = selCenterX - (popoverWidth / 2);

  // Viewport padding to ensure buttons never get cut off at edges
  const padding = 8;
  const maxLeft = Math.max(padding, window.innerWidth - popoverWidth - padding);
  left = Math.max(padding, Math.min(maxLeft, left));

  // Vertical calculation:
  // Default: 8px above the top of the selection
  let top = rect.top - popoverHeight - 8;

  // If overflowing top of viewport (or upper navigation bar), flip below selection
  if (top < 10) {
    top = rect.bottom + 8;
  }

  // If flipping below would overflow the bottom of the viewport
  if (top + popoverHeight > window.innerHeight - padding) {
    top = Math.max(padding, window.innerHeight - popoverHeight - padding);
  }

  selectionPopoverEl.style.left = `${Math.round(left)}px`;
  selectionPopoverEl.style.top = `${Math.round(top)}px`;
}

document.addEventListener("selectionchange", handleSelectionChange);

// Mouseup anywhere in document ensures selection is finalized after dragging across text in any pane
document.addEventListener("mouseup", (e) => {
  if (isInteractingWithPopover) return;
  setTimeout(handleSelectionChange, 10);
});

// Capture-phase scroll listener catches scrolling in docView, transcriptList, chatMessages, or any other pane
window.addEventListener("scroll", () => {
  if (selectionPopoverEl && !selectionPopoverEl.classList.contains("hidden")) {
    handleSelectionChange();
  }
}, { passive: true, capture: true });

// Also attach direct scroll listeners on key scrolling containers
[docContentEl, docViewEl, transcriptListEl, chatMessagesEl].forEach(el => {
  if (el) {
    el.addEventListener("scroll", () => {
      if (selectionPopoverEl && !selectionPopoverEl.classList.contains("hidden")) {
        handleSelectionChange();
      }
    }, { passive: true });
  }
});

window.addEventListener("resize", () => {
  if (selectionPopoverEl && !selectionPopoverEl.classList.contains("hidden")) {
    handleSelectionChange();
  }
});

// Global mouseup failsafe to release isInteractingWithPopover
window.addEventListener("mouseup", () => {
  if (isInteractingWithPopover) {
    setTimeout(() => {
      isInteractingWithPopover = false;
    }, 200);
  }
});

if (selectionPopoverEl) {
  selectionPopoverEl.addEventListener("mousedown", (e) => {
    isInteractingWithPopover = true;
    e.preventDefault(); // Prevent text deselection on popover click
  });
  selectionPopoverEl.addEventListener("mouseup", () => {
    setTimeout(() => {
      isInteractingWithPopover = false;
    }, 200);
  });
}

if (popExplain) {
  popExplain.addEventListener("click", () => {
    if (!currentSelectedText) return;
    const quote = currentSelectedText;
    selectionPopoverEl.classList.add("hidden");
    switchToTab("chat-view");
    sendChatMessage("请用通俗易懂的语言解释划线概念或原委，并列举一个生动的比喻或实际案例。", quote);
    window.getSelection()?.removeAllRanges();
  });
}

if (popEvidence) {
  popEvidence.addEventListener("click", () => {
    if (!currentSelectedText) return;
    const quote = currentSelectedText;
    selectionPopoverEl.classList.add("hidden");
    switchToTab("chat-view");
    sendChatMessage("视频作者是如何论证或说明这一点的？请结合原片证据与具体时间戳详细展开。", quote);
    window.getSelection()?.removeAllRanges();
  });
}

if (popAsk) {
  popAsk.addEventListener("click", () => {
    if (!currentSelectedText) return;
    const quote = currentSelectedText;
    selectionPopoverEl.classList.add("hidden");
    switchToTab("chat-view");
    setQuote(quote);
    chatInputEl.placeholder = "针对划线内容输入您的问题 (按 Enter 发送)...";
    chatInputEl.focus();
    window.getSelection()?.removeAllRanges();
  });
}

// Quick Question Pills
document.querySelectorAll(".quick-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    const q = pill.getAttribute("data-q");
    if (q) {
      sendChatMessage(q);
    }
  });
});

// Render Markdown for Chat with Timestamp Pills
function renderChatMarkdown(rawMarkdown, containerEl, showCursor = false) {
  if (!rawMarkdown) {
    containerEl.innerHTML = showCursor ? '<span class="chat-cursor"></span>' : '';
    return;
  }

  let text = rawMarkdown;

  // 1. Strip any backticks around timestamp links if the model outputted `[MM:SS](seek:123)`
  text = text.replace(/`(\[(?:⏱️\s*)?\d{1,2}:\d{2}(?::\d{2})?\]\(seek:\d+\))`?/g, '$1');

  // 2. Clean up any raw HTML tags that might have leaked into Markdown
  text = text.replace(/<a\s+[^>]*href=["']seek:(\d+)["'][^>]*>.*?(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?).*?<\/a>/gi, '[$2](seek:$1)');
  text = text.replace(/<a\s+class=["']timestamp-pill["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

  // 3. Parse Markdown FIRST using marked
  let html = "";
  if (window.marked) {
    html = window.marked.parse(text);
  } else {
    html = `<p>${escapeHtml(text)}</p>`;
  }

  // 4. Convert seek links into clickable timestamp-pill anchors in the HTML
  html = html.replace(
    /<a\s+href=["']seek:(\d+)["'][^>]*>(?:⏱️\s*)?([^<]+)<\/a>/gi,
    '<a class="timestamp-pill" href="seek:$1" title="点击跳转原片对应时间">⏱️ $2</a>'
  );

  // Fallback: Also replace any raw [MM:SS](seek:123) that marked didn't parse as a link
  html = html.replace(
    /\[(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\]\(seek:(\d+)\)/g,
    '<a class="timestamp-pill" href="seek:$2" title="点击跳转原片对应时间">⏱️ $1</a>'
  );

  // If marked accidentally escaped HTML into &lt;a class="timestamp-pill" ...&gt; or code blocks, unwrap it cleanly!
  html = html.replace(
    /(?:<code>)?(?:&lt;|<)a\s+class=["']timestamp-pill["']\s+href=["']seek:(\d+)["'][^>]*>(?:⏱️\s*)?([^<]+)(?:&lt;|<)\/a(?:&gt;|>)(?:<\/code>)?/gi,
    '<a class="timestamp-pill" href="seek:$1" title="点击跳转原片对应时间">⏱️ $2</a>'
  );

  if (showCursor) {
    html += '<span class="chat-cursor"></span>';
  }

  containerEl.innerHTML = html;
}

// Send Chat Message & Handle SSE Stream
async function sendChatMessage(userText, quote = "") {
  const query = (userText || "").trim();
  if (!query) return;

  if (isStreamingChat) {
    return;
  }

  if (!currentSummaryData || !currentSummaryData.markdown) {
    alert("请先点击【一键总结】解析视频，之后方可使用伴读答疑功能！");
    return;
  }

  const activeQuote = quote || currentQuotedText || "";
  clearQuote();

  // Hide welcome placeholder on first interaction
  if (chatWelcomeEl) {
    chatWelcomeEl.classList.add("hidden");
  }

  // 1. Render User Message
  const userMsgEl = document.createElement("div");
  userMsgEl.className = "chat-msg user";

  let userContentHtml = "";
  if (activeQuote) {
    userContentHtml += `<div class="chat-quote-tag">引用: "${escapeHtml(activeQuote)}"</div>`;
  }
  userContentHtml += `<div class="chat-content">${escapeHtml(query).replace(/\n/g, '<br>')}</div>`;
  userMsgEl.innerHTML = userContentHtml;
  chatMessagesEl.appendChild(userMsgEl);

  // Clear input & reset height
  chatInputEl.value = "";
  chatInputEl.style.height = "auto";

  // 2. Render Assistant Message (Streaming Placeholder)
  const assistantMsgEl = document.createElement("div");
  assistantMsgEl.className = "chat-msg assistant";
  const assistantContentEl = document.createElement("div");
  assistantContentEl.className = "chat-content";
  assistantContentEl.innerHTML = '<span class="chat-cursor"></span>';
  assistantMsgEl.appendChild(assistantContentEl);
  chatMessagesEl.appendChild(assistantMsgEl);

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  // 3. Request Backend Stream
  isStreamingChat = true;
  btnSendChat.disabled = true;

  const payload = {
    question: query,
    quote: activeQuote,
    video_title: (currentActiveTab && currentActiveTab.title) || (currentSummaryData && currentSummaryData.title) || "",
    summary_markdown: (currentSummaryData && currentSummaryData.markdown) || "",
    subtitles: currentSubtitles || [],
    history: chatHistory.slice(-8)
  };

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`服务响应异常 (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullAssistantText = "";
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, "");
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          const chunkText = data.chunk || data.text || "";
          if (chunkText) {
            fullAssistantText += chunkText;
            renderChatMarkdown(fullAssistantText, assistantContentEl, true);
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
          } else if (data.error) {
            fullAssistantText += `\n\n> ⚠️ 回答出错: ${data.error}`;
            renderChatMarkdown(fullAssistantText, assistantContentEl, false);
          }
        } catch (parseErr) {
          // ignore stream parse errors
        }
      }
    }

    // Finalize assistant bubble
    renderChatMarkdown(fullAssistantText, assistantContentEl, false);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // Record round in conversation history
    const recordedUserPrompt = activeQuote ? `[引用片段: "${activeQuote}"]\n${query}` : query;
    chatHistory.push({ role: "user", text: recordedUserPrompt });
    chatHistory.push({ role: "assistant", text: fullAssistantText });

    saveSessionState();

  } catch (err) {
    assistantContentEl.innerHTML = `<span style="color:#f87171;">⚠️ 提问失败: ${escapeHtml(err.message || "调度服务未响应")}</span>`;
  } finally {
    isStreamingChat = false;
    btnSendChat.disabled = false;
    setTimeout(() => chatInputEl.focus(), 60);
  }
}

// Chat Input Auto-Resize & Shortcuts
if (chatInputEl) {
  chatInputEl.addEventListener("input", () => {
    chatInputEl.style.height = "auto";
    chatInputEl.style.height = Math.min(chatInputEl.scrollHeight, 120) + "px";
  });

  chatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = chatInputEl.value.trim();
      if (val) {
        sendChatMessage(val);
      }
    }
  });
}

if (btnSendChat) {
  btnSendChat.addEventListener("click", () => {
    const val = chatInputEl.value.trim();
    if (val) {
      sendChatMessage(val);
    }
  });
}

// --- 10. Settings Management & Native Folder Browser ---
async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) {
      const cfg = await res.json();
      document.getElementById("cfg-api-key").value = cfg.gemini_api_key || "";
      document.getElementById("cfg-model").value = cfg.gemini_model || "gemini-3.5-flash";
      document.getElementById("cfg-proxy").value = cfg.proxy_url || "http://127.0.0.1:7897";
      cfgSaveDirInput.value = cfg.save_directory || "";
      document.getElementById("cfg-auto-save").checked = cfg.auto_save === true;
      if (cfg.font_scale) {
        const val = parseFloat(cfg.font_scale);
        if (!isNaN(val)) applyFontScale(val, false);
      }
      if (cfg.theme_mode) {
        applyTheme(cfg.theme_mode);
      }
    }
  } catch (e) {
    console.warn("Could not load settings:", e);
  }
}

// Trigger Native Windows Folder Picker
async function browseWindowsFolder() {
  try {
    const currentVal = cfgSaveDirInput.value.trim();
    const res = await fetch(`${API_BASE}/api/select-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial_dir: currentVal })
    });
    const data = await res.json();
    if (data.status === "ok" && data.path) {
      cfgSaveDirInput.value = data.path;
    }
  } catch (err) {
    alert("调起文件夹选择器失败，请确认本地服务正常运行: " + err.message);
  }
}

btnBrowseFolder.addEventListener("click", browseWindowsFolder);
cfgSaveDirInput.addEventListener("click", browseWindowsFolder);

async function saveSettings() {
  const newCfg = {
    gemini_api_key: document.getElementById("cfg-api-key").value.trim(),
    gemini_model: document.getElementById("cfg-model").value,
    proxy_url: document.getElementById("cfg-proxy").value.trim(),
    save_directory: cfgSaveDirInput.value.trim(),
    auto_save: document.getElementById("cfg-auto-save").checked,
    font_scale: currentFontScale,
    theme_mode: currentTheme
  };

  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCfg)
    });
    if (res.ok) {
      alert("配置已成功更新并生效！");
      settingsModal.classList.add("hidden");
    }
  } catch (e) {
    alert("保存配置失败，请确认本地服务正常运行。");
  }
}

btnSettings.addEventListener("click", () => {
  loadSettings();
  settingsModal.classList.remove("hidden");
});

btnCloseSettings.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

btnSaveSettings.addEventListener("click", saveSettings);
btnSummarize.addEventListener("click", startSummarize);

// Restart Backend Service Logic
if (btnRestartService) {
  btnRestartService.addEventListener("click", async () => {
    if (btnRestartService.disabled) return;

    btnRestartService.disabled = true;
    btnRestartService.innerHTML = '<span class="btn-icon">⏳</span> 正在重启服务...';
    if (restartHint) restartHint.textContent = "正在释放旧端口并重启后台进程，约耗时 1~2 秒...";

    if (settingsServiceStatus) {
      settingsServiceStatus.textContent = "● 正在平滑重启...";
      settingsServiceStatus.className = "status-badge checking";
    }
    serviceStatusEl.textContent = "🟡 正在重启服务...";
    serviceStatusEl.className = "status-badge checking";

    try {
      await fetch(`${API_BASE}/api/restart`, { method: "POST" });
    } catch (e) {
      // Expected if old server process exits and closes connection quickly
    }

    // Poll /api/health until server comes back online
    let attempts = 0;
    const maxAttempts = 30; // 30 * 500ms = 15 seconds
    const checkInterval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
        if (res.ok) {
          clearInterval(checkInterval);
          serviceStatusEl.textContent = "🟢 调度服务在线";
          serviceStatusEl.className = "status-badge online";
          if (settingsServiceStatus) {
            settingsServiceStatus.textContent = "● 服务已重新就绪";
            settingsServiceStatus.className = "status-badge online";
          }
          if (restartHint) restartHint.textContent = "✅ 服务重启成功！最新代码已成功载入";
          btnRestartService.innerHTML = '<span class="btn-icon">✅</span> 重启成功！';

          setTimeout(() => {
            btnRestartService.disabled = false;
            btnRestartService.innerHTML = '<span class="btn-icon">🔄</span> 重启本地服务';
            if (restartHint) restartHint.textContent = "更新代码后点击此处，后台将自动重启并载入最新代码";
          }, 2500);
          return;
        }
      } catch (e) {
        // Still in the process of starting up
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        serviceStatusEl.textContent = "🔴 调度服务未启动";
        serviceStatusEl.className = "status-badge offline";
        if (settingsServiceStatus) {
          settingsServiceStatus.textContent = "● 重启超时未响应";
          settingsServiceStatus.className = "status-badge offline";
        }
        if (restartHint) restartHint.textContent = "⚠️ 重启等待超时，请确认是否需要手动双击运行 start_server.bat";
        btnRestartService.disabled = false;
        btnRestartService.innerHTML = '<span class="btn-icon">🔄</span> 重试重启';
      }
    }, 500);
  });
}

// --- 10. Real-time Service Logs Terminal ---
async function fetchAndRenderLogs() {
  if (!logsModal || logsModal.classList.contains("hidden")) return;

  try {
    const res = await fetch(`${API_BASE}/api/logs?limit=400`, { method: "GET" });
    if (!res.ok) {
      if (res.status === 404) {
        if (logsStatusHint) logsStatusHint.textContent = "⚠️ 后台尚未加载日志接口，请在设置中点击【🔄 重启服务】";
        if (logsList && lastLogText === "") {
          logsList.innerHTML = `
            <div class="log-empty" style="padding:40px 20px;text-align:center;color:#f59e0b;">
              <div style="font-size:24px;margin-bottom:8px;">⚠️</div>
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">后台服务版本较旧，尚未加载实时日志接口</div>
              <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;">
                请点击右上角【设置 ⚙️】➔【🔄 重启本地服务】<br>或双击运行 backend 目录下的 start_server.bat 即可实时显示日志。
              </div>
            </div>
          `;
        }
      } else {
        if (logsStatusHint) logsStatusHint.textContent = `⚠️ 获取日志失败 (HTTP ${res.status})`;
      }
      return;
    }

    const data = await res.json();
    const logs = data.logs || [];
    if (logsBadge) logsBadge.textContent = `${logs.length} 行`;
    if (logsStatusHint) logsStatusHint.textContent = `● 实时追踪中 (共 ${data.total || logs.length} 条)`;

    const rawJoined = logs.join("\n");
    if (rawJoined === lastLogText && logsList.children.length > 1) {
      return;
    }
    lastLogText = rawJoined;

    if (logs.length === 0) {
      logsList.innerHTML = '<div class="log-empty">暂无后台运行日志</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    logs.forEach(line => {
      const row = document.createElement("div");
      row.className = "log-row";

      // Detect timestamp [HH:MM:SS]
      const tsMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
      let timeText = "";
      let msgText = line;
      if (tsMatch) {
        timeText = tsMatch[1];
        msgText = tsMatch[2];
      }

      // Detect log level / category for styling
      const lower = msgText.toLowerCase();
      if (lower.includes("error") || lower.includes("exception") || lower.includes("失败") || lower.includes("fail") || lower.includes("503")) {
        row.classList.add("log-error");
      } else if (lower.includes("gemini") || lower.includes("stream") || lower.includes("prompt")) {
        row.classList.add("log-gemini");
      } else if (lower.includes("ok") || lower.includes("成功") || lower.includes("200 ok") || lower.includes("completed")) {
        row.classList.add("log-success");
      } else if (lower.includes("warn") || lower.includes("排队") || lower.includes("备选") || lower.includes("重试")) {
        row.classList.add("log-warn");
      } else {
        row.classList.add("log-info");
      }

      if (timeText) {
        const timeSpan = document.createElement("span");
        timeSpan.className = "log-time";
        timeSpan.textContent = `[${timeText}]`;
        row.appendChild(timeSpan);
      }

      const msgSpan = document.createElement("span");
      msgSpan.className = "log-msg";
      msgSpan.textContent = msgText;
      row.appendChild(msgSpan);

      fragment.appendChild(row);
    });

    logsList.innerHTML = "";
    logsList.appendChild(fragment);

    if (chkAutoScroll && chkAutoScroll.checked && logsBody) {
      logsBody.scrollTop = logsBody.scrollHeight;
    }
  } catch (err) {
    if (logsStatusHint) logsStatusHint.textContent = "🔴 本地调度服务未连接";
  }
}

function openLogsModal() {
  if (!logsModal) return;
  if (settingsModal && !settingsModal.classList.contains("hidden")) {
    settingsModal.classList.add("hidden");
  }
  logsModal.classList.remove("hidden");
  fetchAndRenderLogs();

  if (logPollTimer) clearInterval(logPollTimer);
  logPollTimer = setInterval(fetchAndRenderLogs, 1500);
}

function closeLogsModal() {
  if (!logsModal) return;
  logsModal.classList.add("hidden");
  if (logPollTimer) {
    clearInterval(logPollTimer);
    logPollTimer = null;
  }
}

if (btnLogs) {
  btnLogs.addEventListener("click", openLogsModal);
}
if (btnOpenLogsFromSettings) {
  btnOpenLogsFromSettings.addEventListener("click", openLogsModal);
}
if (btnCloseLogs) {
  btnCloseLogs.addEventListener("click", closeLogsModal);
}

// Clear Logs
if (btnClearLogs) {
  btnClearLogs.addEventListener("click", async () => {
    try {
      await fetch(`${API_BASE}/api/logs/clear`, { method: "POST" });
      lastLogText = "";
      fetchAndRenderLogs();
    } catch (e) {
      logsList.innerHTML = '<div class="log-empty">日志已在本地清空</div>';
    }
  });
}

// Copy Logs
if (btnCopyLogs) {
  btnCopyLogs.addEventListener("click", () => {
    if (!lastLogText) {
      alert("当前没有可复制的日志！");
      return;
    }
    navigator.clipboard.writeText(lastLogText).then(() => {
      const orig = btnCopyLogs.textContent;
      btnCopyLogs.textContent = "✅ 已复制！";
      setTimeout(() => { btnCopyLogs.textContent = orig; }, 1500);
    });
  });
}

// Refresh Logs
if (btnRefreshLogs) {
  btnRefreshLogs.addEventListener("click", () => {
    lastLogText = "";
    fetchAndRenderLogs();
  });
}

// Init
initTheme();
initFontScale();
checkServiceHealth();
detectCurrentVideoTab();
restoreSessionState();

chrome.tabs.onActivated.addListener(detectCurrentVideoTab);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Capture both full reloads and SPA history pushState/title navigation
  if (changeInfo.status === "complete" || changeInfo.url || changeInfo.title) {
    detectCurrentVideoTab();
  }
});
