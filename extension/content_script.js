// Content script running on Bilibili and YouTube pages

function findActiveVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  const playing = videos.find(v => !v.paused && v.currentTime > 0);
  if (playing) return playing;

  return videos[0];
}

function showSeekToast(seconds) {
  let toast = document.getElementById('ai-summary-seek-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ai-summary-seek-toast';
    toast.style.cssText = `
      position: fixed;
      top: 60px;
      right: 30px;
      background: rgba(30, 41, 59, 0.9);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999999;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      pointer-events: none;
      transition: opacity 0.3s ease, transform 0.3s ease;
      opacity: 0;
      transform: translateY(-10px);
    `;
    document.body.appendChild(toast);
  }

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  toast.innerText = `⏱️ 已跳转至 ${timeStr}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(window.__seekToastTimer);
  window.__seekToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
  }, 1800);
}

// --- Subtitle Dialogue Density Quality Guard (Triple-Check) ---
const MUSIC_NOISE_RE = /^(?:[♪♫♬♩\s\-_—～~·.*#]+|[([（【\s]*(?:音乐|背景音乐|纯音乐|Music|BGM|Instrumental|Soundtrack)[)\]}）】\s]*)$/i;
const CJK_ALPHANUM_RE = /[\u4e00-\u9fa5a-zA-Z0-9]/g;

function isValidDialogueSubtitles(subtitles, videoDuration = 0) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return false;

  let totalLines = subtitles.length;
  let dialogueLines = 0;
  let totalRealChars = 0;
  let maxTimestamp = 0;

  for (const item of subtitles) {
    const content = (item.content || "").trim();
    const toT = parseFloat(item.to || 0);
    if (toT > maxTimestamp) maxTimestamp = toT;

    if (MUSIC_NOISE_RE.test(content)) continue;

    const chars = content.match(CJK_ALPHANUM_RE);
    const count = chars ? chars.length : 0;
    if (count >= 2) {
      dialogueLines++;
      totalRealChars += count;
    }
  }

  const estimatedDuration = videoDuration > 0 ? videoDuration : maxTimestamp;

  // 1. Minimum character threshold (at least 100 chars, or 35 chars for very short clips)
  const minCharThreshold = (estimatedDuration > 0 && estimatedDuration < 60) ? 35 : 100;
  if (totalRealChars < minCharThreshold) return false;

  // 2. Dialogue line ratio (at least 30% lines must contain real speech)
  if ((dialogueLines / totalLines) < 0.30) return false;

  // 3. Dialogue density per minute for videos >= 2 minutes
  if (estimatedDuration >= 120) {
    const charsPerMin = totalRealChars / (estimatedDuration / 60);
    if (charsPerMin < 20) return false;
  }

  return true;
}

function extractCleanBvid(urlOrPath) {
  if (!urlOrPath) return "";
  const match = urlOrPath.match(/(BV[a-zA-Z0-9]{10})/i);
  return match ? match[1] : "";
}

// --- Direct In-Browser Bilibili Subtitle Extractor with BV-ID Verification ---
async function tryExtractBilibiliSubtitlesInBrowser(expectedBvid = "") {
  const currentBvid = extractCleanBvid(window.location.pathname) || extractCleanBvid(window.location.href);
  if (!currentBvid) return { rejected: true, reason: "no_bvid_found" };

  // Handshake Quality Guard: Strict BV-ID match prevents any stale SPA cross-video contamination
  if (expectedBvid && expectedBvid.toLowerCase() !== currentBvid.toLowerCase()) {
    console.warn(`[ContentScript] Stale SPA detected! Page bvid (${currentBvid}) !== expected bvid (${expectedBvid}). Rejecting.`);
    return {
      rejected: true,
      reason: "bvid_mismatch",
      currentBvid: currentBvid,
      expectedBvid: expectedBvid
    };
  }

  const bvid = currentBvid;

  try {
    // 1. Get cid using in-browser fetch with user's login cookies
    const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      credentials: "include"
    });
    const viewData = await viewRes.json();
    if (!viewData || viewData.code !== 0 || !viewData.data) return null;

    const cid = viewData.data.cid;
    const title = getPageVideoTitle() || viewData.data.title || document.title;
    const author = viewData.data.owner ? viewData.data.owner.name : "UP主";
    const video = findActiveVideo();
    const videoDuration = parseFloat(viewData.data.duration || (video ? video.duration : 0)) || 0;

    // 2. Query player v2 API (authenticated by current session)
    const playerRes = await fetch(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`, {
      credentials: "include"
    });
    const playerData = await playerRes.json();
    const subList = playerData?.data?.subtitle?.subtitles || [];

    if (subList.length === 0) return { subtitles: [], bvid: bvid, empty: true };

    // Prefer Chinese subtitle (zh-CN or ai-zh)
    let bestSub = subList[0];
    for (const s of subList) {
      if (s.lan && (s.lan.includes('zh') || s.lan.includes('ai'))) {
        bestSub = s;
        break;
      }
    }

    let subUrl = bestSub.subtitle_url;
    if (!subUrl) return { subtitles: [], bvid: bvid, empty: true };
    if (subUrl.startsWith('//')) subUrl = 'https:' + subUrl;

    // 3. Fetch subtitle JSON
    const subJsonRes = await fetch(subUrl);
    const subJson = await subJsonRes.json();
    const body = subJson.body || [];

    if (body.length === 0) return { subtitles: [], bvid: bvid, empty: true };

    const subtitles = body.map(item => ({
      from: Math.round(parseFloat(item.from) * 100) / 100,
      to: Math.round(parseFloat(item.to) * 100) / 100,
      content: (item.content || "").trim()
    })).filter(item => item.content.length > 0);

    // Duration Consistency Check: prevent stale subtitles from previous video in SPA navigation
    let maxTimestamp = 0;
    for (const item of subtitles) {
      if (item.to > maxTimestamp) maxTimestamp = item.to;
    }

    if (videoDuration > 0) {
      // If subtitle extends beyond 125% of video duration, it's definitely from another video!
      if (maxTimestamp > (videoDuration * 1.25 + 10)) {
        console.warn(`[ContentScript] Stale subtitles detected! Max timestamp ${maxTimestamp}s > video duration ${videoDuration}s. Discarding.`);
        return {
          subtitles: [],
          rejected: true,
          reason: "duration_mismatch",
          bvid: bvid,
          videoDuration: videoDuration,
          maxTimestamp: maxTimestamp,
          title: title,
          author: author
        };
      }
      // If video is >= 90s but subtitle duration is less than 35% of total video
      if (videoDuration >= 90 && maxTimestamp < (videoDuration * 0.35)) {
        console.warn(`[ContentScript] Incomplete subtitles detected! Max timestamp ${maxTimestamp}s << video duration ${videoDuration}s. Discarding.`);
        return {
          subtitles: [],
          rejected: true,
          reason: "duration_incomplete",
          bvid: bvid,
          videoDuration: videoDuration,
          maxTimestamp: maxTimestamp,
          title: title,
          author: author
        };
      }
    }

    // Triple-Check Quality Guard: Reject if mostly background music / noise tags
    if (!isValidDialogueSubtitles(subtitles, videoDuration)) {
      console.warn("[ContentScript] In-browser subtitles rejected: failed Triple-Check dialogue density check (mostly BGM/music/noise).");
      return {
        subtitles: [],
        rejected: true,
        reason: "insufficient_dialogue_density",
        bvid: bvid,
        title: title,
        author: author
      };
    }

    return {
      subtitles: subtitles,
      bvid: bvid,
      title: title,
      author: author,
      videoDuration: videoDuration,
      sub_source: `bilibili_browser_${bestSub.lan_doc || 'ai_zh'}`
    };
  } catch (err) {
    console.warn("[ContentScript] In-browser Bilibili sub extraction error:", err);
    return null;
  }
}

// Extract accurate real-time video title from page DOM (immune to SPA title lag)
function getPageVideoTitle() {
  // 1. Try Bilibili specific title elements in DOM
  const biliH1 = document.querySelector('h1.video-title') 
    || document.querySelector('.video-info-title-inner')
    || document.querySelector('.video-info-title')
    || document.querySelector('#viewbox_report .video-title')
    || document.querySelector('.player-wrap .video-title');
  if (biliH1 && biliH1.textContent.trim()) {
    return biliH1.textContent.trim();
  }

  // 2. Try YouTube specific title elements
  const ytH1 = document.querySelector('ytd-watch-metadata #title h1 yt-formatted-string')
    || document.querySelector('h1.ytd-video-primary-info-renderer')
    || document.querySelector('#title h1');
  if (ytH1 && ytH1.textContent.trim()) {
    return ytH1.textContent.trim();
  }

  // 3. Fallback to document.title with common platform suffix cleanup
  let title = (document.title || "").trim();
  title = title.replace(/_哔哩哔哩_bilibili$/i, '').replace(/ - YouTube$/i, '').trim();
  return title || "未知视频";
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SEEK") {
    const targetSeconds = parseFloat(request.seconds);
    const video = findActiveVideo();
    if (video && !isNaN(targetSeconds)) {
      video.currentTime = targetSeconds;
      video.play().catch(() => {});
      showSeekToast(targetSeconds);
      sendResponse({ status: "success", currentTime: video.currentTime });
    } else {
      sendResponse({ status: "failed", reason: "Video player not found" });
    }
    return true;
  }

  if (request.action === "GET_VIDEO_INFO") {
    const video = findActiveVideo();
    sendResponse({
      title: getPageVideoTitle(),
      url: window.location.href,
      currentTime: video ? video.currentTime : 0
    });
    return true;
  }

  if (request.action === "EXTRACT_SUBTITLES_DIRECT") {
    if (window.location.hostname.includes("bilibili.com")) {
      const expectedBvid = request.expected_bvid || "";
      tryExtractBilibiliSubtitlesInBrowser(expectedBvid).then(result => {
        if (result && result.rejected) {
          sendResponse({ status: "rejected", data: result });
        } else if (result && result.subtitles && result.subtitles.length > 0) {
          sendResponse({ status: "success", data: result });
        } else {
          sendResponse({ status: "empty", bvid: extractCleanBvid(window.location.href) });
        }
      }).catch(e => {
        sendResponse({ status: "error", error: e.toString() });
      });
      return true; // async sendResponse
    } else {
      sendResponse({ status: "unsupported_platform" });
      return true;
    }
  }
});
