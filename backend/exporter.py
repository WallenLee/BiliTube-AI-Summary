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

def validate_safe_file_path(path: str, must_exist: bool = False) -> str:
    """Validate that path does not contain traversal, and only targets safe markdown/txt extensions"""
    if not path or not path.strip():
        raise ValueError("路径不能为空")
    raw = path.strip()
    # Block path traversal attempts in raw input and normalized path
    if ".." in raw.replace('/', '\\').split('\\'):
        raise ValueError("安全限制：禁止使用含有 '..' 的相对路径跳转")
    norm = os.path.normpath(raw)
    if ".." in norm.replace('/', '\\').split('\\'):
        raise ValueError("安全限制：禁止使用含有 '..' 的相对路径跳转")
    ext = os.path.splitext(norm)[1].lower()
    if ext not in [".md", ".markdown", ".txt"]:
        raise ValueError(f"安全限制：仅允许操作 Markdown 或纯文本文件 ({ext})，禁止打开或写入其他类型程序或脚本")
    if must_exist and not os.path.exists(norm):
        raise FileNotFoundError(f"目标文件不存在: {norm}")
    return norm

def export_summary_to_file(markdown_content: str, title: str, target_file_path: str = "") -> tuple[str, str]:
    """Save summary markdown to the configured storage path.
    If target_file_path is provided and exists (or its directory exists),
    it will overwrite the existing file in-place rather than creating duplicate copies.
    """
    cfg = load_config()
    save_dir = cfg.get("save_directory") or os.path.join(os.path.expanduser("~"), "Documents", "VideoSummaries")
    os.makedirs(save_dir, exist_ok=True)

    # Check if we should overwrite an existing file directly
    if target_file_path:
        safe_target = validate_safe_file_path(target_file_path, must_exist=False)
        if os.path.exists(safe_target) or os.path.isdir(os.path.dirname(safe_target)):
            file_path = safe_target
        else:
            date_prefix = time.strftime("%Y-%m-%d")
            safe_title = sanitize_filename(title)
            file_path = os.path.join(save_dir, f"[{date_prefix}] {safe_title}.md")
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
    safe_path = validate_safe_file_path(file_path, must_exist=True)
    # On Windows, os.startfile opens with default app (e.g. Obsidian or VS Code)
    os.startfile(safe_path)
