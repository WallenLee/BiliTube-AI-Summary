import json
import os
import re
import tempfile
import urllib.request
import yt_dlp
from asr_sensevoice import transcribe_audio, parse_srt
from config import load_config

def get_bilibili_subtitles(url: str, progress_callback=None) -> tuple[list[dict], dict] | None:
    """Fast channel: Attempt to extract subtitles from Bilibili via web API"""
    match = re.search(r'(BV[a-zA-Z0-9]+)', url, re.IGNORECASE)
    if not match:
        return None
    bvid = match.group(1)

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
        
        meta["sub_source"] = "bilibili_api"
        return subtitles, meta

    except Exception as e:
        print(f"[BiliSub] Fast probe error: {e}")
        return None

def get_subtitles_via_ytdlp(url: str, progress_callback=None) -> tuple[list[dict], dict] | None:
    """Fast channel: Attempt to get subtitles using yt-dlp metadata"""
    cfg = load_config()
    proxy = cfg.get("proxy_url") if "youtube.com" in url or "youtu.be" in url else None

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
            meta = {
                "title": title,
                "author": author,
                "url": url,
                "platform": "youtube" if ("youtube.com" in url or "youtu.be" in url) else "other"
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
                            meta["sub_source"] = "yt_dlp_json3"
                            return subtitles, meta
                    except Exception as je:
                        print(f"[YT-DLP Sub] JSON3 parse failed: {je}")

                # If VTT format
                if 'WEBVTT' in raw_sub:
                    subtitles = parse_srt(raw_sub)
                    if subtitles:
                        meta["sub_source"] = "yt_dlp_vtt"
                        return subtitles, meta

            return None, meta

    except Exception as e:
        print(f"[YT-DLP Sub] Error: {e}")
        return None

def download_audio_and_transcribe(url: str, meta: dict, progress_callback=None) -> tuple[list[dict], dict]:
    """Slow channel fallback: Download pure audio and run local SenseVoice ASR"""
    cfg = load_config()
    proxy = cfg.get("proxy_url") if "youtube.com" in url or "youtu.be" in url else None
    ffmpeg_bin = cfg.get("ffmpeg_bin", r"D:\ffmpeg\bin\ffmpeg.exe")

    temp_dir = tempfile.gettempdir()
    output_template = os.path.join(temp_dir, "ai_summary_%(id)s.%(ext)s")

    if progress_callback:
        progress_callback("未检测到现有字幕，正在快速抓取纯音频 (yt-dlp)...")

    ydl_opts = {
        # 1. 优先抓取低码率纯人声音频（32k~64k 对 ASR 而言绰绰有余，体积比高音质缩小 75%）
        'format': 'ba[abr<=64]/worstaudio/ba/b',
        'outtmpl': output_template,
        # 2. 开启 8 线程并发分片下载，突破平台单线程限速
        'concurrent_fragment_downloads': 8,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '0',
        }],
        'ffmpeg_location': os.path.dirname(ffmpeg_bin),
        'postprocessor_args': ['-ar', '16000', '-ac', '1', '-threads', '4'],
        'quiet': True,
        'no_warnings': True,
    }
    if proxy:
        ydl_opts['proxy'] = proxy

    audio_file = None
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            res = ydl.extract_info(url, download=True)
            if not meta.get("title") and res:
                meta["title"] = res.get('title', '视频总结')
                meta["author"] = res.get('uploader', '未知UP主')
            
            # Find the generated wav file
            video_id = res.get('id', 'temp')
            expected_wav = os.path.join(temp_dir, f"ai_summary_{video_id}.wav")
            if os.path.exists(expected_wav):
                audio_file = expected_wav
            else:
                # Find any matching file
                for f in os.listdir(temp_dir):
                    if f.startswith("ai_summary_") and f.endswith(".wav"):
                        audio_file = os.path.join(temp_dir, f)
                        break

        if not audio_file or not os.path.exists(audio_file):
            raise FileNotFoundError("Audio extraction failed, WAV file not found.")

        if progress_callback:
            progress_callback("音频抓取完成，开始调用本地 SenseVoice 识别字幕...")

        subtitles = transcribe_audio(audio_file, progress_callback)
        meta["sub_source"] = "local_sensevoice_asr"
        return subtitles, meta

    finally:
        if audio_file and os.path.exists(audio_file):
            try:
                os.remove(audio_file)
            except Exception:
                pass

def extract_subtitles_pipeline(url: str, progress_callback=None) -> tuple[list[dict], dict]:
    """Dual-channel entry point: Fast first, then slow fallback"""
    meta = {"title": "未知视频", "author": "未知UP主", "url": url}

    # 1. Try Bilibili Fast Channel
    if "bilibili.com" in url or "b23.tv" in url:
        res = get_bilibili_subtitles(url, progress_callback)
        if res:
            subtitles, m = res
            if m:
                meta.update(m)
            if subtitles:
                return subtitles, meta

    # 2. Try YouTube / General yt-dlp Fast Channel
    res = get_subtitles_via_ytdlp(url, progress_callback)
    if res:
        subtitles, m = res
        if m:
            meta.update(m)
        if subtitles:
            return subtitles, meta

    # 3. Slow Channel Fallback: Download Audio + Local SenseVoice
    return download_audio_and_transcribe(url, meta, progress_callback)
