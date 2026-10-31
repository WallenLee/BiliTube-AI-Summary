import os
import re
import subprocess
import tempfile
from pathlib import Path
from config import load_config

def srt_time_to_seconds(time_str: str) -> float:
    """Convert 00:01:23,456 or 00:01:23.456 to seconds (float)"""
    time_str = time_str.strip().replace(',', '.')
    parts = time_str.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return 0.0

def parse_srt(srt_content: str) -> list[dict]:
    """Parse SRT string into list of dicts: [{'from': 1.5, 'to': 4.2, 'content': '...'}]"""
    blocks = re.split(r'\n\s*\n', srt_content.strip())
    subtitles = []
    
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue
        
        # Look for time line: e.g. 00:00:01,000 --> 00:00:04,000
        time_index = -1
        for i, line in enumerate(lines):
            if '-->' in line:
                time_index = i
                break
        
        if time_index != -1 and time_index + 1 < len(lines):
            time_parts = lines[time_index].split('-->')
            start_sec = srt_time_to_seconds(time_parts[0])
            end_sec = srt_time_to_seconds(time_parts[1])
            text = " ".join(lines[time_index + 1:])
            # Filter out SenseVoice emotion/audio tags if any, e.g. <|NEUTRAL|> or [laughter]
            clean_text = re.sub(r'<\|.*?\|>', '', text).strip()
            if clean_text:
                subtitles.append({
                    "from": round(start_sec, 2),
                    "to": round(end_sec, 2),
                    "content": clean_text
                })
    return subtitles

def convert_to_wav16k(input_path: str, ffmpeg_bin: str) -> str:
    """Convert any audio/video file to 16kHz 16-bit mono WAV"""
    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav.close()
    out_path = temp_wav.name

    cmd = [
        ffmpeg_bin, "-y",
        "-i", input_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        out_path
    ]
    
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        if os.path.exists(out_path):
            os.remove(out_path)
        raise RuntimeError(f"FFmpeg conversion failed: {proc.stderr}")
    
    return out_path

def transcribe_audio(audio_path: str, progress_callback=None) -> list[dict]:
    """Transcribe an audio file using local SenseVoice engine"""
    cfg = load_config()
    bin_path = cfg.get("sensevoice_bin", r"D:\funasr\bin\llama-funasr-sensevoice.exe")
    model_path = cfg.get("sensevoice_model", r"D:\funasr\models\sensevoice-small-q8.gguf")
    vad_path = cfg.get("vad_model", r"D:\funasr\models\fsmn-vad.gguf")
    ffmpeg_bin = cfg.get("ffmpeg_bin", r"D:\ffmpeg\bin\ffmpeg.exe")

    if not os.path.exists(bin_path):
        raise FileNotFoundError(f"SenseVoice binary not found at: {bin_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"SenseVoice model not found at: {model_path}")

    # 若已经是 16kHz WAV（如 yt-dlp 直接输出），直接使用，省去多余的二次转码耗时
    need_cleanup = False
    if audio_path.lower().endswith(".wav"):
        wav_path = audio_path
    else:
        if progress_callback:
            progress_callback("正在准备音频格式 (转码为 16kHz 单声道 WAV)...")
        wav_path = convert_to_wav16k(audio_path, ffmpeg_bin)
        need_cleanup = True

    try:
        if progress_callback:
            progress_callback("SenseVoice 本地 ASR 识别中 (AMD Vulkan GPU 加速)...")

        # 优先使用显卡 Vulkan 硬件加速
        cmd = [
            bin_path,
            "-m", model_path,
            "--vad", vad_path,
            "-a", wav_path,
            "--backend", "vulkan",
            "--srt"
        ]

        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        # 仅当显卡执行崩溃/报错时才降级 CPU
        if result.returncode != 0:
            if progress_callback:
                progress_callback("Vulkan 模式遇到异常，降级为 CPU 模式识别中...")
            cmd[cmd.index("vulkan")] = "cpu"
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace"
            )

        if result.returncode != 0:
            raise RuntimeError(f"SenseVoice transcription failed: {result.stderr}")

        srt_output = result.stdout
        subtitles = parse_srt(srt_output)
        return subtitles

    finally:
        if need_cleanup and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                pass
