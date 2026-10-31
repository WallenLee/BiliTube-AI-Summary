import json
import os
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "config.json"

DEFAULT_CONFIG = {
    "gemini_api_key": "YOUR_GEMINI_API_KEY",
    "gemini_model": "gemini-3.5-flash-lite",
    "proxy_url": "http://127.0.0.1:7897",
    "save_directory": os.path.normpath(os.path.expanduser("~/Documents/VideoSummaries")),
    "auto_save": False,
    "font_scale": 1.0,
    "theme_mode": "dark",
    "sensevoice_bin": "",
    "sensevoice_model": "",
    "vad_model": "",
    "ffmpeg_bin": "ffmpeg"
}

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            merged = DEFAULT_CONFIG.copy()
            merged.update(data)
            return merged
    except Exception as e:
        print(f"[Config] Error loading config: {e}, using default.")
        return DEFAULT_CONFIG.copy()

def save_config(new_config: dict) -> dict:
    cfg = load_config()
    cfg.update(new_config)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg
