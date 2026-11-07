import gc
import json
import os
import re
import tempfile
import urllib.request
import uuid
import yt_dlp
from asr_sensevoice import transcribe_audio, parse_srt
from config import load_config

# Regex to detect lines that are purely background music, noise or non-dialogue tags
MUSIC_OR_NOISE_RE = re.compile(
    r'^(?:[♪♫♬♩\s\-_—～~·\.\*\#]+|'
    r'[\(\[\{（【\s]*(?:音乐|背景音乐|纯音乐|Music|BGM|Instrumental|Soundtrack)[\)\]\}）】\s]*)$',
    re.IGNORECASE
)
CJK_OR_ALPHANUM_RE = re.compile(r'[\u4e00-\u9fa5a-zA-Z0-9]')

def is_valid_dialogue_subtitles(subtitles: list[dict], video_duration: float = 0) -> bool:
    """Triple-Check Subtitle Quality Guard:
    Checks if subtitles contain genuine spoken dialogue density rather than merely BGM/music/noise tags.
    Does NOT remove or alter original subtitle items.
    """
    if not subtitles or len(subtitles) == 0:
        return False

    total_lines = len(subtitles)
    dialogue_lines = 0
    total_real_chars = 0
    max_timestamp = 0.0

    for item in subtitles:
        content = (item.get("content") or "").strip()
        to_t = float(item.get("to") or 0.0)
        if to_t > max_timestamp:
            max_timestamp = to_t

        # If it's purely a music or noise symbol, it's not spoken dialogue
        if MUSIC_OR_NOISE_RE.match(content):
            continue

        # Count genuine CJK or alphanumeric characters
        real_chars = CJK_OR_ALPHANUM_RE.findall(content)
        char_count = len(real_chars)
        if char_count >= 2:
            dialogue_lines += 1
            total_real_chars += char_count

    estimated_duration = video_duration if video_duration > 0 else max_timestamp

    # Check 1: Minimum total dialogue characters
    min_char_threshold = 35 if (0 < estimated_duration < 60) else 100
    if total_real_chars < min_char_threshold:
        return False

    # Check 2: Dialogue line ratio (at least 30% of lines must be real speech)
    dialogue_ratio = dialogue_lines / float(total_lines)
    if dialogue_ratio < 0.30:
        return False

    # Check 3: Dialogue density per minute for longer videos (>= 2 minutes)
    if estimated_duration >= 120.0:
        duration_minutes = estimated_duration / 60.0
        chars_per_min = total_real_chars / duration_minutes
        if chars_per_min < 20.0:
            return False

    return True

def normalize_video_url(raw_url: str) -> str:
    """Strip all tracking and query params, guarantee canonical pure video URL"""
    if not raw_url:
        return ""
    match = re.search(r'(BV[a-zA-Z0-9]{10})', raw_url, re.IGNORECASE)
    if match:
        return f"https://www.bilibili.com/video/{match.group(1)}"
    yt_match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', raw_url)
    if yt_match:
        return f"https://www.youtube.com/watch?v={yt_match.group(1)}"
    x_match = re.search(r'(?:x\.com|twitter\.com)/([^/]+)/status/(\d+)', raw_url)
    if x_match:
        return f"https://x.com/{x_match.group(1)}/status/{x_match.group(2)}"
    return raw_url.split('?')[0].split('#')[0]

def extract_bvid(url: str) -> str:
    """Extract canonical video ID from any URL (BVID for Bilibili, 11-char ID for YouTube, Tweet ID for X)"""
    if not url:
        return ""
    match = re.search(r'(BV[a-zA-Z0-9]{10})', url, re.IGNORECASE)
    if match:
        return match.group(1)
    yt_match = re.search(r'(?:v=|youtu\.be/|embed/|v/|shorts/)([a-zA-Z0-9_-]{11})', url)
    if yt_match:
        return yt_match.group(1)
    x_match = re.search(r'(?:x\.com|twitter\.com)/[^/]+/status/(\d+)', url)
    if x_match:
        return x_match.group(1)
    return ""

def get_video_expected_duration(url: str) -> float:
    """Fast probe of video duration in seconds (<=0.2s) without downloading media"""
    bvid = extract_bvid(url)
    if bvid and bvid.upper().startswith("BV"):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.bilibili.com"
            }
            view_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
            req = urllib.request.Request(view_url, headers=headers)
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return float(data.get('data', {}).get('duration', 0))
        except Exception as e:
            print(f"[DurationProbe] Error: {e}")
    return 0.0

def is_subtitles_duration_consistent(subtitles: list[dict], expected_duration: float) -> tuple[bool, str]:
    """Check if subtitle timestamps match the real video duration to prevent stale subtitles from previous video"""
    if not subtitles or expected_duration <= 0:
        return True, "ok"
    
    max_ts = max((float(s.get("to", 0.0)) for s in subtitles), default=0.0)
    
    # 1. Stale overflow check: Subtitles cannot exceed 125% of video duration (plus 15s grace buffer)
    if max_ts > (expected_duration * 1.25 + 15.0):
        return False, f"字幕时间戳({max_ts:.1f}s)严重超出视频时长({expected_duration:.1f}s)，判定为前序视频缓存串台"

    # 2. Incomplete check: For videos >= 90s, subtitles cannot end before 35% of video
    if expected_duration >= 90.0 and max_ts < (expected_duration * 0.35):
        return False, f"字幕时间戳({max_ts:.1f}s)明显远低于视频时长({expected_duration:.1f}s)，判定为残缺字幕"

    return True, "ok"

def get_bilibili_subtitles(url: str, progress_callback=None) -> tuple[list[dict], dict] | None:
    """Fast channel: Attempt to extract subtitles from Bilibili via web API using canonical BVID"""
    bvid = extract_bvid(url)
    if not bvid:
        return None

    if progress_callback:
        progress_callback("正在快速探查 B 站官方/AI 字幕...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com"
    }

    try:
        # 1. Get view info (cid, title, author)
        view_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
        req = urllib.request.Request(view_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        
        if data.get('code') != 0:
            return None
        
        v_data = data.get('data', {})
        cid = v_data.get('cid')
        title = v_data.get('title', '未知视频')
        author = v_data.get('owner', {}).get('name', '未知UP主')

        meta = {
            "title": title,
            "author": author,
            "url": f"https://www.bilibili.com/video/{bvid}",
            "platform": "bilibili",
            "bvid": bvid,
            "cid": cid
        }

        # 2. Get player v2 info for subtitles
        player_url = f"https://api.bilibili.com/x/player/v2?bvid={bvid}&cid={cid}"
        req2 = urllib.request.Request(player_url, headers=headers)
        with urllib.request.urlopen(req2, timeout=5) as resp2:
            p_data = json.loads(resp2.read().decode('utf-8'))
        
        sub_list = p_data.get('data', {}).get('subtitle', {}).get('subtitles', [])
        if not sub_list:
            return None, meta  # No subtitles found, but we have metadata!

        # Pick the best subtitle (prefer Chinese zh-CN or ai-zh)
        sub_item = sub_list[0]
        for s in sub_list:
            lan = s.get('lan', '')
            if 'zh' in lan or 'ai' in lan:
                sub_item = s
                break

        sub_url = sub_item.get('subtitle_url', '')
        if not sub_url:
            return None, meta
        
        if sub_url.startswith('//'):
            sub_url = 'https:' + sub_url

        if progress_callback:
            progress_callback(f"发现 B 站字幕（{sub_item.get('lan_doc', '中文')}），正在极速加载...")

        req_sub = urllib.request.Request(sub_url, headers=headers)
        with urllib.request.urlopen(req_sub, timeout=8) as resp_sub:
            sub_json = json.loads(resp_sub.read().decode('utf-8'))
        
        body = sub_json.get('body', [])
        subtitles = []
        for item in body:
            from_t = item.get('from', 0.0)
            to_t = item.get('to', 0.0)
            content = item.get('content', '').strip()
            if content:
                subtitles.append({
                    "from": round(float(from_t), 2),
                    "to": round(float(to_t), 2),
                    "content": content
                })
        
        # Triple-Check Quality Guard
        if not is_valid_dialogue_subtitles(subtitles):
            if progress_callback:
                progress_callback("⚠️ B 站在线字幕仅包含背景音乐或有效对白不足，自动降级至音频转写通道...")
            print("[BiliSub] Subtitles rejected: failed Triple-Check dialogue density check (mostly BGM/music/noise).")
            return None, meta
        
        meta["sub_source"] = "bilibili_api"
        return subtitles, meta

    except Exception as e:
        print(f"[BiliSub] Fast probe error: {e}")
        return None

def get_subtitles_via_ytdlp(url: str, progress_callback=None) -> tuple[list[dict], dict] | None:
    """Fast channel: Attempt to get subtitles using yt-dlp metadata"""
    cfg = load_config()
    proxy = cfg.get("proxy_url") if any(k in url for k in ["youtube.com", "youtu.be", "x.com", "twitter.com"]) else None

    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['zh-Hans', 'zh-CN', 'zh', 'en', 'auto'],
        'quiet': True,
        'no_warnings': True,
    }
    if proxy:
        ydl_opts['proxy'] = proxy

    try:
        if progress_callback:
            progress_callback("正在探查平台字幕 (yt-dlp)...")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None

            title = info.get('title', '未知视频')
            author = info.get('uploader', info.get('channel', '未知作者'))
            platform = "youtube" if ("youtube.com" in url or "youtu.be" in url) else ("x" if ("x.com" in url or "twitter.com" in url) else "other")
            meta = {
                "title": title,
                "author": author,
                "url": url,
                "platform": platform
            }

            subs = info.get('subtitles', {})
            auto_subs = info.get('automatic_captions', {})

            # Look for suitable subtitle format (json3 or vtt)
            selected_sub = None
            for pool in [subs, auto_subs]:
                for lang_key in ['zh-Hans', 'zh-CN', 'zh', 'en']:
                    if lang_key in pool:
                        formats = pool[lang_key]
                        # Try to find json3 or vtt
                        for fmt in formats:
                            if fmt.get('ext') in ['json3', 'vtt', 'srv1']:
                                selected_sub = fmt
                                break
                    if selected_sub:
                        break
                if selected_sub:
                    break

            if not selected_sub and auto_subs:
                # Fallback to any first auto sub
                first_lang = next(iter(auto_subs.values()), [])
                if first_lang:
                    selected_sub = first_lang[0]

            if selected_sub and selected_sub.get('url'):
                sub_url = selected_sub['url']
                req = urllib.request.Request(sub_url, headers={"User-Agent": "Mozilla/5.0"})
                # Set proxy if youtube
                if proxy:
                    handler = urllib.request.ProxyHandler({'http': proxy, 'https': proxy})
                    opener = urllib.request.build_opener(handler)
                else:
                    opener = urllib.request.build_opener()

                with opener.open(req, timeout=10) as resp:
                    raw_sub = resp.read().decode('utf-8', errors='replace')

                # If JSON3 format (YouTube)
                if selected_sub.get('ext') == 'json3' or raw_sub.strip().startswith('{'):
                    try:
                        s_data = json.loads(raw_sub)
                        subtitles = []
                        events = s_data.get('events', [])
                        for ev in events:
                            t_start = ev.get('tStartMs', 0) / 1000.0
                            d_dur = ev.get('dDurationMs', 0) / 1000.0
                            segs = ev.get('segs', [])
                            txt = "".join(s.get('utf8', '') for s in segs).strip()
                            if txt and txt != '\n':
                                subtitles.append({
                                    "from": round(t_start, 2),
                                    "to": round(t_start + d_dur, 2),
                                    "content": txt
                                })
                        if subtitles:
                            if not is_valid_dialogue_subtitles(subtitles):
                                if progress_callback:
                                    progress_callback("⚠️ 在线字幕仅包含背景音乐或有效对白不足，自动降级至音频转写通道...")
                                print("[YT-DLP Sub] Subtitles rejected: failed Triple-Check dialogue density check.")
                            else:
                                meta["sub_source"] = "yt_dlp_json3"
                                return subtitles, meta
                    except Exception as je:
                        print(f"[YT-DLP Sub] JSON3 parse failed: {je}")

                # If VTT format
                if 'WEBVTT' in raw_sub:
                    subtitles = parse_srt(raw_sub)
                    if subtitles:
                        if not is_valid_dialogue_subtitles(subtitles):
                            if progress_callback:
                                progress_callback("⚠️ 在线字幕仅包含背景音乐或有效对白不足，自动降级至音频转写通道...")
                            print("[YT-DLP Sub] Subtitles rejected: failed Triple-Check dialogue density check.")
                        else:
                            meta["sub_source"] = "yt_dlp_vtt"
                            return subtitles, meta

            return None, meta

    except Exception as e:
        print(f"[YT-DLP Sub] Error: {e}")
        return None

def download_audio_and_transcribe(url: str, meta: dict, progress_callback=None) -> tuple[list[dict], dict]:
    """Slow channel fallback: Download pure audio and run local SenseVoice ASR.
    Uses canonical URL and UUID-isolated filenames to strictly prevent any cross-video audio pollution.
    """
    clean_url = normalize_video_url(url)
    cfg = load_config()
    proxy = cfg.get("proxy_url") if any(k in clean_url for k in ["youtube.com", "youtu.be", "x.com", "twitter.com"]) else None
    ffmpeg_bin = cfg.get("ffmpeg_bin", "").strip() or "ffmpeg"

    temp_dir = tempfile.gettempdir()
    # UUID task isolation: guarantees 100% no cross-talk with previous or parallel tasks
    task_uid = uuid.uuid4().hex[:12]
    file_prefix = f"bilitube_{task_uid}"
    output_template = os.path.join(temp_dir, f"{file_prefix}.%(ext)s")
    expected_wav = os.path.join(temp_dir, f"{file_prefix}.wav")

    if progress_callback:
        progress_callback("未检测到有效字幕，正在快速抓取轻量音频 (yt-dlp)...")

    ydl_opts = {
        # 1. 优先抓取原声人声音频；若为 X/Twitter 等单流 MP4 格式则降级抓取整体视频提取音轨
        'format': 'ba[format_note*=original]/ba[format_note*=default]/ba[language^=en]/ba[language^=zh]/ba[abr<=96]/worstaudio/ba/b/best',
        'outtmpl': output_template,
        # 2. 严格禁用合集/剧集连带下载，确保 100% 仅下载目标单体视频
        'noplaylist': True,
        # 3. 开启 8 线程并发分片下载，突破平台单线程限速
        'concurrent_fragment_downloads': 8,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '0',
        }],
        'postprocessor_args': ['-ar', '16000', '-ac', '1', '-threads', '4'],
        'quiet': True,
        'no_warnings': True,
    }

    # 智能定位 FFmpeg 目录（自适应 Windows / macOS / Linux）
    ffmpeg_dir = os.path.dirname(ffmpeg_bin)
    if not ffmpeg_dir or not os.path.exists(ffmpeg_dir):
        import shutil
        found = shutil.which(ffmpeg_bin) or shutil.which("ffmpeg")
        if found:
            ffmpeg_dir = os.path.dirname(found)
    if ffmpeg_dir and os.path.exists(ffmpeg_dir):
        ydl_opts['ffmpeg_location'] = ffmpeg_dir

    if proxy:
        ydl_opts['proxy'] = proxy

    audio_file = None
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            res = ydl.extract_info(clean_url, download=True)
            if res:
                if (not meta.get("title") or meta.get("title") in ("未知视频", "视频总结")) and res.get('title'):
                    meta["title"] = res.get('title')
                if (not meta.get("author") or meta.get("author") in ("未知UP主", "未知作者")) and (res.get('uploader') or res.get('channel')):
                    meta["author"] = res.get('uploader') or res.get('channel')
            
            # Find the generated wav file strictly matching this task's unique prefix
            if os.path.exists(expected_wav):
                audio_file = expected_wav
            else:
                # Strictly isolate: only find files starting with THIS task's unique prefix
                for f in os.listdir(temp_dir):
                    if f.startswith(file_prefix) and f.endswith(".wav"):
                        audio_file = os.path.join(temp_dir, f)
                        break

        if not audio_file or not os.path.exists(audio_file):
            raise FileNotFoundError("音频提取失败，未生成对应的 WAV 文件。请检查 FFmpeg 是否已正确安装。")

        if progress_callback:
            progress_callback("音频抓取完成，开始调用本地 SenseVoice 识别字幕...")

        subtitles = transcribe_audio(audio_file, progress_callback)
        meta["sub_source"] = "local_sensevoice_asr"
        return subtitles, meta

    finally:
        # Force release any Windows process file locks and cleanup strictly isolated temp files
        gc.collect()
        for f in os.listdir(temp_dir):
            if f.startswith(file_prefix):
                try:
                    os.remove(os.path.join(temp_dir, f))
                except Exception:
                    pass

def extract_subtitles_pipeline(url: str, progress_callback=None) -> tuple[list[dict], dict]:
    """Dual-channel entry point: Fast first, then slow fallback, strictly anchored to canonical video ID"""
    clean_url = normalize_video_url(url)
    meta = {"title": "未知视频", "author": "未知UP主", "url": clean_url}

    # 1. Try Bilibili Fast Channel (Official API querying canonical BVID)
    if "bilibili.com" in clean_url or "b23.tv" in clean_url:
        res = get_bilibili_subtitles(clean_url, progress_callback)
        if res:
            subtitles, m = res
            if m:
                meta.update(m)
            if subtitles:
                return subtitles, meta

    # 2. Try YouTube / General yt-dlp Fast Channel
    res = get_subtitles_via_ytdlp(clean_url, progress_callback)
    if res:
        subtitles, m = res
        if m:
            meta.update(m)
        if subtitles:
            return subtitles, meta

    # 3. Slow Channel Fallback: Download Audio + Local SenseVoice
    cfg = load_config()
    bin_path = cfg.get("sensevoice_bin", "").strip()
    if not bin_path or not os.path.exists(bin_path):
        raise RuntimeError("检测到该视频未提供在线字幕，或在线字幕主要为纯音乐/占位标签导致有效口播缺失。需通过本地 SenseVoice 进行语音识别，请在设置中配置 SenseVoice 路径以开启离线转写，或总结其他带有效字幕的视频。")

    return download_audio_and_transcribe(clean_url, meta, progress_callback)
