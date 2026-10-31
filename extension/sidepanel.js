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
const btnClearAll = document.getElementById("btn-clear-all");

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

// Tabs & Actions
const tabButtons = document.querySelectorAll(".tab-btn");
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const btnResetMap = document.getElementById("btn-reset-map");
const btnCopyMd = document.getElementById("btn-copy-md");
const btnOpenObsidian = document.getElementById("btn-open-obsidian");

// Settings Modal
const settingsModal = document.getElementById("settings-modal");
const btnSettings = document.getElementById("btn-settings");
const btnCloseSettings = document.getElementById("btn-close-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");
const btnBrowseFolder = document.getElementById("btn-browse-folder");
const cfgSaveDirInput = document.getElementById("cfg-save-dir");

// --- 1. Service Health Check ---
async function checkServiceHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
    if (res.ok) {
      serviceStatusEl.textContent = "🟢 调度服务在线";
      serviceStatusEl.className = "status-badge online";
      return true;
    }
  } catch (e) {
    // Service offline
  }
  serviceStatusEl.textContent = "🔴 调度服务未启动";
  serviceStatusEl.className = "status-badge offline";
  return false;
}

// --- 2. Active Tab Detection ---
async function detectCurrentVideoTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    currentActiveTab = tab;

    videoTitleEl.textContent = tab.title || "未知标题";
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
  } catch (err) {
    console.error("Tab detection error:", err);
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
    const tsMatch = content.match(/\[(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\]\(seek:(\d+)\)/);
    if (tsMatch) {
      const timeStr = tsMatch[1];
      const sec = tsMatch[2];
      // Deduplicate consecutive identical timestamps on child nodes (e.g. repeated 00:00)
      if (depth > 0 && timeStr === lastTimestamp) {
        content = content.replace(tsMatch[0], '').trim();
      } else {
        lastTimestamp = timeStr;
        content = content.replace(
          tsMatch[0],
          `<a class="timestamp-pill" href="seek:${sec}" title="点击跳转至 ${timeStr}">⏱️ ${timeStr}</a>`
        ).trim();
      }
    }

    // Convert markdown bold **text** to <strong>text</strong>
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Remove stray outer quotes
    content = content.replace(/^["'“”\s]+|["'“”\s]+$/g, '');

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

  // 2. Clean up any raw HTML tags that might have leaked into Markdown
  cleanMd = cleanMd.replace(/<a\s+[^>]*href=["']seek:(\d+)["'][^>]*>.*?(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?).*?<\/a>/gi, '[$2](seek:$1)');
  cleanMd = cleanMd.replace(/<a\s+class=["']timestamp-pill["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

  // 3. Format standard timestamp syntax [MM:SS](seek:123) into clean clickable pill anchors
  cleanMd = cleanMd.replace(
    /\[(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\]\(seek:(\d+)\)/g,
    '<a class="timestamp-pill" href="seek:$2" title="点击跳转原片对应时间">⏱️ $1</a>'
  );

  if (window.marked) {
    docContentEl.innerHTML = window.marked.parse(cleanMd);
  } else {
    docContentEl.textContent = cleanMd;
  }
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

  if (!currentActiveTab || !currentActiveTab.url) {
    alert("未获取到当前标签页视频链接，请刷新重试。");
    return;
  }

  btnSummarize.disabled = true;
  btnSaveSummary.classList.add("hidden");
  btnClearAll.classList.add("hidden");
  progressContainer.classList.remove("hidden");
  progressText.textContent = "⚡ 正在尝试从当前网页直接捕获官方/AI字幕...";

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

    if (tabRes && tabRes.status === "success" && tabRes.data && tabRes.data.subtitles && tabRes.data.subtitles.length > 0) {
      preExtractedSubtitles = tabRes.data.subtitles;
      if (tabRes.data.title) preTitle = tabRes.data.title;
      subSource = tabRes.data.sub_source || "browser_direct";
      progressText.textContent = `⚡ 网页官方字幕捕获成功 (共 ${preExtractedSubtitles.length} 句)，跳过下载直接总结...`;
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

          currentSummaryData = data;
          emptyStateEl.classList.add("hidden");
          mindmapViewEl.classList.remove("hidden");
          docViewEl.classList.add("hidden");
          transcriptViewEl.classList.add("hidden");

          // Reset tab buttons to mindmap active
          tabButtons.forEach(b => b.classList.remove("active"));
          tabButtons[0].classList.add("active");

          // Render Markmap, Document & Subtitles
          renderMarkmap(data.markdown);
          renderDocView(data.markdown);
          renderTranscript(data.subtitles);

          // Show Action Buttons
          btnClearAll.classList.remove("hidden");

          if (data.file_path) {
            // Auto-saved
            btnSaveSummary.classList.add("hidden");
            btnOpenObsidian.classList.remove("hidden");
            btnOpenObsidian.onclick = () => {
              if (data.obsidian_uri) window.open(data.obsidian_uri);
            };
          } else {
            // Manual Save Mode
            btnSaveSummary.classList.remove("hidden");
            btnSaveSummary.disabled = false;
            btnSaveSummary.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">保存这篇到本地</span>';
            btnOpenObsidian.classList.add("hidden");
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

// Manual Save Handler
btnSaveSummary.addEventListener("click", async () => {
  if (!currentSummaryData || !currentSummaryData.markdown) return;

  btnSaveSummary.disabled = true;
  btnSaveSummary.innerHTML = '<span>⏳ 保存中...</span>';

  try {
    const res = await fetch(`${API_BASE}/api/save-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: currentSummaryData.markdown,
        title: currentSummaryData.title || "视频总结"
      })
    });

    const data = await res.json();
    if (data.status === "ok") {
      btnSaveSummary.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">已存入本地 (点击打开)</span>';
      btnSaveSummary.disabled = false;
      btnSaveSummary.onclick = () => {
        if (data.obsidian_uri) window.open(data.obsidian_uri);
      };
      btnOpenObsidian.classList.remove("hidden");
      btnOpenObsidian.onclick = () => {
        if (data.obsidian_uri) window.open(data.obsidian_uri);
      };
    } else {
      alert("保存失败: " + (data.message || "未知错误"));
      btnSaveSummary.disabled = false;
      btnSaveSummary.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">保存这篇到本地</span>';
    }
  } catch (e) {
    alert("保存出错: " + e.message);
    btnSaveSummary.disabled = false;
    btnSaveSummary.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">保存这篇到本地</span>';
  }
});

// Clear / Reset Handler
btnClearAll.addEventListener("click", () => {
  if (confirm("确定清空当前总结与思维导图吗？（未保存的内容将不留缓存）")) {
    currentSummaryData = null;
    currentSubtitles = [];

    // Clear contents
    docContentEl.innerHTML = "";
    while (markmapSvgEl.firstChild) {
      markmapSvgEl.removeChild(markmapSvgEl.firstChild);
    }
    transcriptListEl.innerHTML = "";

    // Hide panes, reveal empty state
    mindmapViewEl.classList.add("hidden");
    docViewEl.classList.add("hidden");
    transcriptViewEl.classList.add("hidden");
    emptyStateEl.classList.remove("hidden");

    btnSaveSummary.classList.add("hidden");
    btnClearAll.classList.add("hidden");
    btnOpenObsidian.classList.add("hidden");
  }
});

// --- 8. Tab Switching ---
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const targetTab = btn.getAttribute("data-tab");
    mindmapViewEl.classList.add("hidden");
    docViewEl.classList.add("hidden");
    transcriptViewEl.classList.add("hidden");

    if (targetTab === "mindmap-view") {
      mindmapViewEl.classList.remove("hidden");
      if (markmapInstance && markmapInstance.fit) {
        setTimeout(() => markmapInstance.fit(), 100);
      }
    } else if (targetTab === "doc-view") {
      docViewEl.classList.remove("hidden");
    } else if (targetTab === "transcript-view") {
      transcriptViewEl.classList.remove("hidden");
    }
  });
});

// Theme Toggle (Dark / Light)
let isLightTheme = false;
if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    isLightTheme = !isLightTheme;
    const wrapper = document.querySelector(".markmap-wrapper");
    if (wrapper) {
      if (isLightTheme) {
        wrapper.classList.add("light-theme");
        btnThemeToggle.textContent = "☀️ 浅色底 (点击切深色)";
      } else {
        wrapper.classList.remove("light-theme");
        btnThemeToggle.textContent = "🌙 深色底 (点击切浅色)";
      }
    }
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

// --- 9. Settings Management & Native Folder Browser ---
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
    auto_save: document.getElementById("cfg-auto-save").checked
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

// Init
checkServiceHealth();
detectCurrentVideoTab();

chrome.tabs.onActivated.addListener(detectCurrentVideoTab);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    detectCurrentVideoTab();
  }
});
