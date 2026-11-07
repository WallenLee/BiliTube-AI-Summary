// Content script running on Bilibili, YouTube, and X (Twitter) pages

let lastActiveVideo = null;
let lastActiveVideoTime = 0;

// Track active video across timelines/feeds (play, playing, timeupdate)
['play', 'playing', 'timeupdate'].forEach(eventType => {
  document.addEventListener(eventType, (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      lastActiveVideo = e.target;
      lastActiveVideoTime = Date.now();
    }
  }, true);
});

function isXPlatform() {
  const host = window.location.hostname;
  return host.includes('x.com') || host.includes('twitter.com');
}

function getMostVisibleVideo(videos) {
  if (!videos || videos.length === 0) return null;
  let bestVideo = null;
  let minDistance = Infinity;
  const centerY = window.innerHeight / 2;

  for (const v of videos) {
    const rect = v.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    // Visible within viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    const vCenter = rect.top + rect.height / 2;
    const dist = Math.abs(vCenter - centerY);
    if (dist < minDistance) {
      minDistance = dist;
      bestVideo = v;
    }
  }
  return bestVideo || videos[0];
}

function findActiveVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  // 1. Check actively playing video
  const playing = videos.find(v => !v.paused && !v.ended && v.currentTime > 0);
  if (playing) return playing;

  // 2. Check most recently played video that is still in DOM
  if (lastActiveVideo && lastActiveVideo.isConnected) {
    return lastActiveVideo;
  }

  // 3. Fallback: video closest to viewport center (most visible)
  return getMostVisibleVideo(videos);
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

// Helper to extract tweet info (status permalink, author, tweet text) from active video on X (Twitter)
function getTweetInfoFromVideo(video) {
  const targetVideo = video || findActiveVideo();
  const currentUrl = window.location.href;
  const detailMatch = currentUrl.match(/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/);

  let statusUrl = "";
  let tweetId = "";
  let author = "";
  let title = "";

  const article = targetVideo ? (
    targetVideo.closest('article[data-testid="tweet"]') ||
    targetVideo.closest('article') ||
    targetVideo.closest('div[data-testid="cellInnerDiv"]')
  ) : null;

  if (article) {
    // 1. Locate tweet status URL
    const timeEl = article.querySelector('time');
    let statusLink = timeEl ? timeEl.closest('a') : null;
    if (!statusLink) {
      const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));
      statusLink = links.find(a => /\/[^/]+\/status\/\d+$/.test(a.getAttribute('href') || '')) || links[0];
    }

    if (statusLink) {
      let href = statusLink.getAttribute('href') || "";
      if (href.startsWith('/')) {
        href = 'https://x.com' + href;
      }
      const m = href.match(/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/);
      if (m) {
        statusUrl = `https://x.com/${m[1]}/status/${m[2]}`;
        tweetId = m[2];
      }
    }

    // 2. Locate tweet author
    const userEl = article.querySelector('div[data-testid="User-Name"]');
    if (userEl) {
      const rawAuthor = userEl.innerText || userEl.textContent || "";
      const parts = rawAuthor.split('\n').map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        author = parts.slice(0, 2).join(' ');
      }
    }

    // 3. Locate tweet text
    const textEl = article.querySelector('div[data-testid="tweetText"]');
    if (textEl) {
      title = (textEl.innerText || textEl.textContent || "").trim();
    }
  }

  // Fallback to detail page URL if on single status page
  if (!statusUrl && detailMatch) {
    statusUrl = `https://x.com/${detailMatch[1]}/status/${detailMatch[2]}`;
    tweetId = detailMatch[2];
  }

  if (!author && isXPlatform()) {
    const userEl = document.querySelector('article div[data-testid="User-Name"]');
    if (userEl) {
      const parts = (userEl.innerText || userEl.textContent || "").split('\n').map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) author = parts.slice(0, 2).join(' ');
    }
  }

  if (!title && isXPlatform()) {
    const textEl = document.querySelector('article div[data-testid="tweetText"]');
    if (textEl && textEl.textContent.trim()) {
      title = textEl.textContent.trim();
    }
  }

  return {
    url: statusUrl,
    id: tweetId,
    author: author || "X 创作者",
    title: title || "X 视频"
  };
}

// Extract accurate real-time video title from page DOM (immune to SPA title lag)
function getPageVideoTitle() {
  if (isXPlatform()) {
    const video = findActiveVideo();
    const info = getTweetInfoFromVideo(video);
    if (info && info.title && info.title !== "X 视频") {
      return info.title;
    }
    let t = (document.title || "").trim();
    t = t.replace(/\s*\/ X$/i, '').trim();
    return t || "X 视频";
  }

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
    || document.querySelector('ytd-watch-metadata #title h1')
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

// Extract real-time author / channel name from page DOM
function getPageVideoAuthor() {
  if (isXPlatform()) {
    const video = findActiveVideo();
    const info = getTweetInfoFromVideo(video);
    if (info && info.author) {
      return info.author;
    }
    return "X 创作者";
  }
  if (window.location.hostname.includes("bilibili.com")) {
    const authorEl = document.querySelector('.up-name') 
      || document.querySelector('.username')
      || document.querySelector('.up-info__name');
    return authorEl ? authorEl.textContent.trim() : "UP主";
  }
  if (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be")) {
    const chEl = document.querySelector('ytd-watch-metadata #channel-name a')
      || document.querySelector('ytd-watch-metadata ytd-channel-name a')
      || document.querySelector('#owner #channel-name a')
      || document.querySelector('#upload-info #channel-name a')
      || document.querySelector('ytd-channel-name a');
    return chEl ? chEl.textContent.trim() : "YouTube频道";
  }
  return "作者";
}

function extractCleanYtId(urlOrPath) {
  if (!urlOrPath) return "";
  const match = urlOrPath.match(/(?:v=|youtu\.be\/|embed\/|v\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

// Query YouTube's MAIN execution world via bridge to obtain live player response & captionTracks
function getYouTubePlayerResponseViaBridge() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 450);

    const handler = (event) => {
      if (event.source === window && event.data && event.data.type === '__BILITUBE_YT_DATA__') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(event.data.payload);
      }
    };
    window.addEventListener('message', handler);

    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            let pr = null;
            const mp = document.getElementById('movie_player');
            if (mp && typeof mp.getPlayerResponse === 'function') {
              pr = mp.getPlayerResponse();
            }
            if (!pr && window.ytInitialPlayerResponse) {
              pr = window.ytInitialPlayerResponse;
            }
            if (!pr) {
              const flexy = document.querySelector('ytd-watch-flexy');
              if (flexy && flexy.playerData) pr = flexy.playerData;
            }
            window.postMessage({
              type: '__BILITUBE_YT_DATA__',
              payload: pr ? {
                videoId: pr.videoDetails?.videoId,
                title: pr.videoDetails?.title,
                author: pr.videoDetails?.author,
                lengthSeconds: pr.videoDetails?.lengthSeconds,
                captionTracks: pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
              } : null
            }, '*');
          } catch(e) {
            window.postMessage({ type: '__BILITUBE_YT_DATA__', payload: null }, '*');
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      resolve(null);
    }
  });
}

function getYouTubeCaptionTracksFromDom() {
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const txt = s.textContent || "";
    if (txt.includes('captionTracks')) {
      const idx = txt.indexOf('"captionTracks":');
      if (idx !== -1) {
        const start = idx + '"captionTracks":'.length;
        const end = txt.indexOf(']', start) + 1;
        try {
          const tracks = JSON.parse(txt.substring(start, end));
          if (Array.isArray(tracks) && tracks.length > 0) {
            return tracks;
          }
        } catch (e) {}
      }
    }
  }
  return null;
}

// --- Direct In-Browser YouTube Subtitle Extractor with Video-ID Verification ---
async function tryExtractYouTubeSubtitlesInBrowser(expectedYtId = "") {
  const currentYtId = extractCleanYtId(window.location.search) 
    || extractCleanYtId(window.location.pathname) 
    || extractCleanYtId(window.location.href);
  if (!currentYtId) return { rejected: true, reason: "no_ytid_found" };

  // Handshake Quality Guard: Strict YouTube ID match prevents stale SPA cross-video contamination
  if (expectedYtId && expectedYtId !== currentYtId) {
    console.warn(`[ContentScript] Stale SPA detected! Page ytid (${currentYtId}) !== expected ytid (${expectedYtId}). Rejecting.`);
    return {
      rejected: true,
      reason: "ytid_mismatch",
      currentYtId: currentYtId,
      expectedYtId: expectedYtId
    };
  }

  const title = getPageVideoTitle();
  const author = getPageVideoAuthor();
  const video = findActiveVideo();
  const videoDuration = video ? (parseFloat(video.duration) || 0) : 0;

  try {
    let captionTracks = null;
    let videoDetails = null;

    // 1. Try bridge to live player in MAIN world
    const bridgeData = await getYouTubePlayerResponseViaBridge();
    if (bridgeData && (!bridgeData.videoId || bridgeData.videoId === currentYtId)) {
      captionTracks = bridgeData.captionTracks;
      videoDetails = bridgeData;
    }

    // 2. Fallback to DOM script scan
    if (!captionTracks || captionTracks.length === 0) {
      captionTracks = getYouTubeCaptionTracksFromDom();
    }

    if (!captionTracks || captionTracks.length === 0) {
      return {
        subtitles: [],
        bvid: currentYtId,
        ytid: currentYtId,
        title: title,
        author: author,
        empty: true
      };
    }

    // 3. Select best subtitle track (Chinese first, then English, then translatable)
    let bestTrack = null;
    let isTranslated = false;

    // a. Human-uploaded Chinese
    bestTrack = captionTracks.find(t => (t.languageCode || '').toLowerCase().startsWith('zh') && t.kind !== 'asr');

    // b. Auto-generated Chinese
    if (!bestTrack) {
      bestTrack = captionTracks.find(t => (t.languageCode || '').toLowerCase().startsWith('zh'));
    }

    // c. Human-uploaded English
    if (!bestTrack) {
      bestTrack = captionTracks.find(t => (t.languageCode || '').toLowerCase().startsWith('en') && t.kind !== 'asr');
    }

    // d. Auto-generated English
    if (!bestTrack) {
      bestTrack = captionTracks.find(t => (t.languageCode || '').toLowerCase().startsWith('en'));
    }

    // e. If translatable to Chinese
    let targetSubUrl = "";
    if (bestTrack) {
      targetSubUrl = bestTrack.baseUrl;
    } else {
      const translatable = captionTracks.find(t => t.isTranslatable || t.baseUrl);
      if (translatable) {
        bestTrack = translatable;
        targetSubUrl = translatable.baseUrl + '&tlang=zh-Hans';
        isTranslated = true;
      } else {
        bestTrack = captionTracks[0];
        targetSubUrl = bestTrack.baseUrl;
      }
    }

    if (!targetSubUrl) {
      return { subtitles: [], bvid: currentYtId, ytid: currentYtId, title: title, author: author, empty: true };
    }

    // Request fmt=json3 for robust, millisecond-accurate timestamps
    if (!targetSubUrl.includes('fmt=')) {
      targetSubUrl += '&fmt=json3';
    }

    // 4. In-browser authenticated fetch (immune to 429 and anti-bot blocks)
    const subRes = await fetch(targetSubUrl, { credentials: "include" });
    const rawText = await subRes.text();

    let subtitles = [];
    if (rawText && rawText.trim().startsWith('{')) {
      try {
        const json = JSON.parse(rawText);
        if (Array.isArray(json.events)) {
          for (const ev of json.events) {
            if (!ev.segs) continue;
            const tStart = Math.round((ev.tStartMs || 0) / 10) / 100;
            const dDur = Math.round((ev.dDurationMs || 0) / 10) / 100;
            const txt = ev.segs.map(s => s.utf8 || '').join('').trim();
            if (txt && txt !== '\n') {
              subtitles.push({
                from: tStart,
                to: Math.round((tStart + dDur) * 100) / 100,
                content: txt
              });
            }
          }
        }
      } catch (je) {
        console.warn("[ContentScript] JSON3 parse error, checking XML:", je);
      }
    }

    // Fallback XML parser
    if (subtitles.length === 0 && rawText && (rawText.includes('<transcript') || rawText.includes('<text'))) {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(rawText, "text/xml");
        const nodes = xml.querySelectorAll("text");
        for (const node of nodes) {
          const start = parseFloat(node.getAttribute("start") || 0);
          const dur = parseFloat(node.getAttribute("dur") || 0);
          const text = (node.textContent || "").trim();
          if (text) {
            subtitles.push({
              from: Math.round(start * 100) / 100,
              to: Math.round((start + dur) * 100) / 100,
              content: text
            });
          }
        }
      } catch (xe) {
        console.warn("[ContentScript] XML parse error:", xe);
      }
    }

    if (subtitles.length === 0) {
      return { subtitles: [], bvid: currentYtId, ytid: currentYtId, title: title, author: author, empty: true };
    }

    // Quality check: Duration & Dialogue density
    let maxTimestamp = 0;
    for (const item of subtitles) {
      if (item.to > maxTimestamp) maxTimestamp = item.to;
    }

    if (videoDuration > 0) {
      if (maxTimestamp > (videoDuration * 1.25 + 10)) {
        console.warn(`[ContentScript] Stale subtitles detected! Max timestamp ${maxTimestamp}s > video duration ${videoDuration}s.`);
        return {
          subtitles: [],
          rejected: true,
          reason: "duration_mismatch",
          bvid: currentYtId,
          ytid: currentYtId,
          videoDuration: videoDuration,
          maxTimestamp: maxTimestamp,
          title: title,
          author: author
        };
      }
    }

    if (!isValidDialogueSubtitles(subtitles, videoDuration)) {
      console.warn("[ContentScript] Subtitles rejected: failed dialogue density check (mostly noise/music).");
      return {
        subtitles: [],
        rejected: true,
        reason: "insufficient_dialogue_density",
        bvid: currentYtId,
        ytid: currentYtId,
        title: title,
        author: author
      };
    }

    const langLabel = bestTrack.languageCode || (isTranslated ? 'zh-Hans_translated' : 'auto');
    const finalTitle = (videoDetails && videoDetails.title) ? videoDetails.title : title;
    const finalAuthor = (videoDetails && videoDetails.author) ? videoDetails.author : author;

    return {
      subtitles: subtitles,
      bvid: currentYtId, // Unified ID field
      ytid: currentYtId,
      title: finalTitle,
      author: finalAuthor,
      videoDuration: videoDuration,
      sub_source: `youtube_browser_${langLabel}`
    };

  } catch (err) {
    console.warn("[ContentScript] In-browser YouTube sub extraction error:", err);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SEEK") {
    const targetSeconds = parseFloat(request.seconds);
    const video = findActiveVideo();
    if (video && !isNaN(targetSeconds)) {
      if (isXPlatform()) {
        try {
          video.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }
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
    if (isXPlatform()) {
      const info = getTweetInfoFromVideo(video);
      sendResponse({
        title: info ? info.title : getPageVideoTitle(),
        author: info ? info.author : getPageVideoAuthor(),
        url: (info && info.url) ? info.url : window.location.href,
        tweetId: info ? info.id : "",
        currentTime: video ? video.currentTime : 0
      });
      return true;
    }

    sendResponse({
      title: getPageVideoTitle(),
      author: getPageVideoAuthor(),
      url: window.location.href,
      currentTime: video ? video.currentTime : 0
    });
    return true;
  }

  if (request.action === "EXTRACT_SUBTITLES_DIRECT") {
    if (isXPlatform()) {
      const video = findActiveVideo();
      const info = getTweetInfoFromVideo(video);
      sendResponse({
        status: "empty",
        platform: "x",
        url: info?.url || window.location.href,
        bvid: info?.id || "",
        title: info?.title || getPageVideoTitle(),
        author: info?.author || getPageVideoAuthor()
      });
      return true;
    } else if (window.location.hostname.includes("bilibili.com")) {
      const expectedId = request.expected_id || request.expected_bvid || "";
      tryExtractBilibiliSubtitlesInBrowser(expectedId).then(result => {
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
    } else if (window.location.hostname.includes("youtube.com") || window.location.hostname.includes("youtu.be")) {
      const expectedId = request.expected_id || request.expected_bvid || "";
      tryExtractYouTubeSubtitlesInBrowser(expectedId).then(result => {
        if (result && result.rejected) {
          sendResponse({ status: "rejected", data: result });
        } else if (result && result.subtitles && result.subtitles.length > 0) {
          sendResponse({ status: "success", data: result });
        } else {
          sendResponse({ status: "empty", ytid: extractCleanYtId(window.location.href) });
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
