import os
import re
import time
import subprocess
from pathlib import Path
from config import load_config

def sanitize_filename(name: str) -> str:
    """Sanitize title for safe Windows filenames"""
    cleaned = re.sub(r'[\\/*?:"<>|]', '', name)
    cleaned = cleaned.replace('\n', ' ').replace('\r', '').strip()
    return cleaned[:80] if cleaned else "未命名总结"

def export_summary_to_file(markdown_content: str, title: str, target_file_path: str = "") -> tuple[str, str]:
    """Save summary markdown to the configured storage path.
    If target_file_path is provided and exists (or its directory exists),
    it will overwrite the existing file in-place rather than creating duplicate copies.
    """
    cfg = load_config()
    save_dir = cfg.get("save_directory") or os.path.join(os.path.expanduser("~"), "Documents", "VideoSummaries")
    os.makedirs(save_dir, exist_ok=True)

    # Check if we should overwrite an existing file directly
    if target_file_path and (os.path.exists(target_file_path) or os.path.isdir(os.path.dirname(target_file_path))):
        file_path = os.path.normpath(target_file_path)
    else:
        date_prefix = time.strftime("%Y-%m-%d")
        safe_title = sanitize_filename(title)
        file_name = f"[{date_prefix}] {safe_title}.md"
        file_path = os.path.join(save_dir, file_name)

        # Handle duplicates only when creating NEW file
        counter = 1
        base_name = f"[{date_prefix}] {safe_title}"
        while os.path.exists(file_path):
            file_path = os.path.join(save_dir, f"{base_name} ({counter}).md")
            counter += 1

    # Ensure content is clean standard Markdown without raw HTML tag leakage
    clean_content = re.sub(r'<a\s+[^>]*href=["\']seek:(\d+)["\'][^>]*>.*?(?:⏱️\s*)?(\d{1,2}:\d{2}(?::\d{2})?).*?</a>', r'[\2](seek:\1)', markdown_content)
    clean_content = re.sub(r'<a\s+class=["\']timestamp-pill["\'][^>]*>(.*?)</a>', r'\1', clean_content)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(clean_content)

    print(f"[Exporter] Successfully saved to: {file_path}")

    # Generate Obsidian URI
    # Obsidian supports opening by absolute path via: obsidian://open?path=...
    import urllib.parse
    obsidian_uri = f"obsidian://open?path={urllib.parse.quote(file_path)}"

    return file_path, obsidian_uri

def open_file_locally(file_path: str):
    """Open the file using system default application or reveal in Explorer"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # On Windows, os.startfile opens with default app (e.g. Obsidian or VS Code)
    os.startfile(file_path)
