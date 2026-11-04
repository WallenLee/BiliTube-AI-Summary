import asyncio
import collections
import datetime
import json
import os
import re
import sys
import uuid
from typing import Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import load_config, save_config
from dual_sub_engine import (
    extract_subtitles_pipeline,
    is_valid_dialogue_subtitles,
    get_video_expected_duration,
    is_subtitles_duration_consistent,
    normalize_video_url,
    extract_bvid
)
from ai_gemini import generate_video_summary, build_chat_prompt, stream_gemini_chat
from exporter import export_summary_to_file, open_file_locally

# In-memory circular log buffer for live console viewer in browser extension
MAX_LOG_ENTRIES = 800
log_buffer = collections.deque(maxlen=MAX_LOG_ENTRIES)
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

class LogTee:
    """Tee stdout and stderr to standard stream and in-memory log buffer"""
    def __init__(self, original_stream, stream_name="STDOUT"):
        self.original_stream = original_stream
        self.stream_name = stream_name
        self._partial_line = ""

    def write(self, text):
        if self.original_stream:
            try:
                self.original_stream.write(text)
                self.original_stream.flush()
            except Exception:
                pass

        if not text:
            return

        self._partial_line += text
        while "\n" in self._partial_line:
            line, self._partial_line = self._partial_line.split("\n", 1)
            line = line.strip("\r")
            clean_line = ANSI_ESCAPE.sub('', line).strip()
            if clean_line:
                now_str = datetime.datetime.now().strftime("%H:%M:%S")
                log_buffer.append(f"[{now_str}] {clean_line}")

    def flush(self):
        if self.original_stream:
            try:
                self.original_stream.flush()
            except Exception:
                pass

# Install LogTee only once
if not isinstance(sys.stdout, LogTee):
    sys.stdout = LogTee(sys.__stdout__, "STDOUT")
if not isinstance(sys.stderr, LogTee):
    sys.stderr = LogTee(sys.__stderr__, "STDERR")

_boot_time = datetime.datetime.now().strftime("%H:%M:%S")
log_buffer.append(f"[{_boot_time}] [System] 🚀 BiliTube 调度后台已启动 (监听端口: 8765)")
log_buffer.append(f"[{_boot_time}] [System] 实时运行日志拦截器就绪，准备接收解析任务")

def log_system_event(msg: str):
    t_str = datetime.datetime.now().strftime("%H:%M:%S")
    log_buffer.append(f"[{t_str}] [System] {msg}")
    print(f"[System] {msg}")

app = FastAPI(title="Video Summary & Mindmap Studio API")

# Enable CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for task states and SSE queues
tasks: Dict[str, Dict[str, Any]] = {}
task_queues: Dict[str, asyncio.Queue] = {}

class SummarizeRequest(BaseModel):
    url: str
    title: Optional[str] = ""
    author: Optional[str] = ""
    bvid: Optional[str] = ""
    sub_bvid: Optional[str] = ""
    pre_extracted_subtitles: Optional[list] = None
    sub_source: Optional[str] = ""

class ConfigRequest(BaseModel):
    ai_provider: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_base_url: Optional[str] = None
    custom_model: Optional[str] = None
    proxy_url: Optional[str] = None
    save_directory: Optional[str] = None
    auto_save: Optional[bool] = None
    font_scale: Optional[float] = None
    theme_mode: Optional[str] = None
    sensevoice_bin: Optional[str] = None
    sensevoice_model: Optional[str] = None
    vad_model: Optional[str] = None
    ffmpeg_bin: Optional[str] = None

class OpenFileRequest(BaseModel):
    file_path: str

class SaveSummaryRequest(BaseModel):
    markdown: str
    title: str
    target_file_path: Optional[str] = ""

class SelectFolderRequest(BaseModel):
    initial_dir: Optional[str] = ""

class ChatRequest(BaseModel):
    question: str
    quote: Optional[str] = ""
    video_title: Optional[str] = ""
    summary_markdown: Optional[str] = ""
    subtitles: Optional[list] = None
    history: Optional[list] = None

async def notify_task(task_id: str, data: dict):
    """Push event to task's SSE queue and update state"""
    if task_id in tasks:
        tasks[task_id].update(data)
    if task_id in task_queues:
        await task_queues[task_id].put(data)

def run_summarize_workflow(
    task_id: str,
    url: str,
    user_title: str,
    bvid: str = "",
    sub_bvid: str = "",
    pre_subtitles: list = None,
    sub_source: str = "",
    user_author: str = ""
):
    """Synchronous pipeline executed in background executor"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def progress_callback(msg: str):
        loop.run_until_complete(notify_task(task_id, {
            "status": "processing",
            "message": msg
        }))

    try:
        clean_url = normalize_video_url(url)
        target_bvid = bvid or extract_bvid(clean_url)
        meta = {
            "title": user_title or "视频总结",
            "author": user_author or "UP主/作者",
            "url": clean_url,
            "bvid": target_bvid
        }
        
        # Rigorous Double-Defense: BV-ID Hard Binding + Dialogue density + Duration check
        use_pre = False
        if pre_subtitles and len(pre_subtitles) > 0:
            if sub_bvid and target_bvid and sub_bvid.lower() != target_bvid.lower():
                log_system_event(f"⚠️ 预提取字幕 BVID({sub_bvid}) 与目标视频({target_bvid})不符(SPA残留)，果断丢弃！")
                progress_callback("⚠️ 网页字幕视频号不匹配(检测到前序视频缓存)，自动转入服务端通道...")
            elif not is_valid_dialogue_subtitles(pre_subtitles):
                log_system_event("⚠️ 网页捕获字幕有效对白不足(主要为BGM/音乐/噪音占位符)，丢弃并转入服务端通道")
                progress_callback("⚠️ 网页捕获的在线字幕主要为纯音乐/占位符，自动转入服务端通道...")
            else:
                expected_dur = get_video_expected_duration(clean_url)
                dur_ok, dur_msg = is_subtitles_duration_consistent(pre_subtitles, expected_dur)
                if not dur_ok:
                    log_system_event(f"⚠️ {dur_msg}，强制丢弃并转入服务端深度转写通道！")
                    progress_callback(f"⚠️ {dur_msg}，自动转入服务端通道重新转写...")
                else:
                    use_pre = True

        if use_pre:
            progress_callback(f"⚡ 成功捕获原生字幕 (共 {len(pre_subtitles)} 句)，跳过下载直接提炼！")
            subtitles = pre_subtitles
            meta["sub_source"] = sub_source or "browser_direct_ai"
        else:
            if not pre_subtitles:
                progress_callback("开始解析视频链接与字幕通道...")
            subtitles, meta = extract_subtitles_pipeline(clean_url, progress_callback=progress_callback)

        if not subtitles:
            raise RuntimeError("未提取到任何字幕或语音内容")

        if user_title and (not meta.get("title") or meta.get("title") in ("未知视频", "视频总结")):
            meta["title"] = user_title
        if user_author and (not meta.get("author") or meta.get("author") in ("未知UP主", "未知作者", "UP主/作者", "")):
            meta["author"] = user_author

        progress_callback(f"字幕提取就绪 (共 {len(subtitles)} 句)，提交 AI 智能分析与结构化提炼...")
        markdown_result = generate_video_summary(subtitles, meta, progress_callback=progress_callback)

        cfg = load_config()
        file_path = ""
        obsidian_uri = ""
        if cfg.get("auto_save", False):
            progress_callback("正在保存 Markdown 到本地知识库...")
            file_path, obsidian_uri = export_summary_to_file(markdown_result, meta.get("title", "视频总结"))

        # Mark done
        loop.run_until_complete(notify_task(task_id, {
            "status": "completed",
            "message": "总结完成！",
            "markdown": markdown_result,
            "title": meta.get("title", "视频总结"),
            "file_path": file_path,
            "obsidian_uri": obsidian_uri,
            "sub_source": meta.get("sub_source", "未知"),
            "subtitles": subtitles
        }))

    except Exception as e:
        print(f"[Workflow Error] {e}")
        loop.run_until_complete(notify_task(task_id, {
            "status": "error",
            "message": f"处理失败: {str(e)}"
        }))
    finally:
        loop.close()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Video Summary & Mindmap Studio"}

@app.get("/api/diagnose")
def diagnose_env():
    cfg = load_config()
    provider = cfg.get("ai_provider", "gemini")
    gemini_key = (cfg.get("gemini_api_key") or "").strip()
    custom_key = (cfg.get("custom_api_key") or "").strip()
    custom_model = (cfg.get("custom_model") or "").strip()

    if provider == "gemini":
        llm_configured = bool(gemini_key and len(gemini_key) > 5 and not gemini_key.startswith("YOUR_"))
        masked = (gemini_key[:4] + "..." + gemini_key[-4:]) if llm_configured else ""
        provider_label = "Google Gemini"
        model_label = cfg.get("gemini_model", "gemini-3.5-flash-lite")
    elif provider == "ollama":
        llm_configured = True
        masked = "本地免Key"
        provider_label = "Ollama 本地"
        model_label = custom_model or "deepseek-r1"
    else:
        llm_configured = bool(custom_key and len(custom_key) > 3)
        masked = (custom_key[:4] + "..." + custom_key[-4:]) if llm_configured else ""
        names = {
            "anthropic": "Anthropic Claude",
            "deepseek": "DeepSeek 官方",
            "openai": "OpenAI 官方",
            "siliconflow": "硅基流动",
            "moonshot": "Moonshot Kimi",
            "custom": "自定义兼容接口"
        }
        provider_label = names.get(provider, "第三方大模型")
        if provider == "anthropic" and not custom_model:
            model_label = "claude-3-5-sonnet"
        else:
            model_label = custom_model or "默认模型"

    bin_path = (cfg.get("sensevoice_bin") or "").strip() or r"D:\funasr\bin\llama-funasr-sensevoice.exe"
    model_path = (cfg.get("sensevoice_model") or "").strip() or r"D:\funasr\models\sensevoice-small-q8.gguf"
    vad_path = (cfg.get("vad_model") or "").strip() or r"D:\funasr\models\fsmn-vad.gguf"

    has_bin = os.path.exists(bin_path)
    has_model = os.path.exists(model_path)
    has_vad = os.path.exists(vad_path)
    asr_ready = has_bin and has_model and has_vad

    return {
        "status": "ok",
        "service": True,
        "ai_provider": provider,
        "llm": {
            "provider": provider,
            "provider_label": provider_label,
            "model": model_label,
            "configured": llm_configured,
            "masked": masked
        },
        "gemini_key": {
            "configured": llm_configured,
            "masked": masked
        },
        "sensevoice": {
            "ready": asr_ready,
            "bin_exists": has_bin,
            "model_exists": has_model,
            "vad_exists": has_vad,
            "bin_path": bin_path,
            "model_path": model_path
        }
    }

@app.get("/api/config")
def get_config():
    return load_config()

@app.post("/api/config")
def update_config(req: ConfigRequest):
    new_data = {k: v for k, v in req.dict().items() if v is not None}
    saved = save_config(new_data)
    return {"status": "ok", "config": saved}

@app.post("/api/summarize")
async def start_summarize(req: SummarizeRequest, background_tasks: BackgroundTasks):
    raw_url = req.url.strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="URL 不能为空")

    clean_url = normalize_video_url(raw_url)
    target_bvid = req.bvid or extract_bvid(clean_url)

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "task_id": task_id,
        "url": clean_url,
        "bvid": target_bvid,
        "status": "pending",
        "message": "任务初始化中..."
    }
    task_queues[task_id] = asyncio.Queue()

    # Launch background thread with normalized clean URL and BV-ID verification
    background_tasks.add_task(
        run_summarize_workflow,
        task_id,
        clean_url,
        req.title or "",
        target_bvid,
        req.sub_bvid or "",
        req.pre_extracted_subtitles,
        req.sub_source or "",
        req.author or ""
    )

    return {"status": "started", "task_id": task_id}

@app.get("/api/stream/{task_id}")
async def stream_task_progress(task_id: str):
    if task_id not in task_queues:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_generator():
        queue = task_queues[task_id]
        try:
            # Yield initial status if exists
            if task_id in tasks:
                yield f"data: {json.dumps(tasks[task_id], ensure_ascii=False)}\n\n"

            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                if data.get("status") in ["completed", "error"]:
                    break
        finally:
            # Clean up queue when stream ends
            if task_id in task_queues:
                del task_queues[task_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/save-summary")
def save_summary_endpoint(req: SaveSummaryRequest):
    try:
        file_path, obsidian_uri = export_summary_to_file(req.markdown, req.title, req.target_file_path or "")
        return {
            "status": "ok",
            "file_path": file_path,
            "obsidian_uri": obsidian_uri
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/select-folder")
def select_folder_endpoint(req: SelectFolderRequest):
    try:
        import os
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        cfg = load_config()
        init_dir = req.initial_dir or cfg.get("save_directory", "")
        if not os.path.exists(init_dir):
            init_dir = os.path.expanduser("~")

        selected = filedialog.askdirectory(
            title="选择视频总结保存目录",
            initialdir=init_dir
        )
        root.destroy()

        if selected:
            norm_path = os.path.normpath(selected)
            return {"status": "ok", "path": norm_path}
        else:
            return {"status": "cancelled", "path": ""}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/open-file")
def open_file_endpoint(req: OpenFileRequest):
    try:
        open_file_locally(req.file_path)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="提问内容不能为空")

    prompt = build_chat_prompt(
        question=req.question.strip(),
        quote=req.quote or "",
        video_title=req.video_title or "",
        summary_markdown=req.summary_markdown or "",
        subtitles=req.subtitles or [],
        history=req.history or []
    )

    async def event_generator():
        try:
            loop = asyncio.get_event_loop()
            queue = asyncio.Queue()

            def produce():
                try:
                    for chunk in stream_gemini_chat(prompt):
                        asyncio.run_coroutine_threadsafe(queue.put({"type": "token", "text": chunk, "chunk": chunk}), loop)
                    asyncio.run_coroutine_threadsafe(queue.put({"type": "done"}), loop)
                except Exception as e:
                    asyncio.run_coroutine_threadsafe(queue.put({"type": "error", "error": str(e)}), loop)

            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            executor.submit(produce)

            while True:
                item = await queue.get()
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
                if item.get("type") in ["done", "error"]:
                    break
            executor.shutdown(wait=False)

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/restart")
def restart_server_endpoint(background_tasks: BackgroundTasks):
    """Trigger graceful server restart by spawning a detached process after releasing port 8765"""
    def restart_process():
        import time
        import subprocess
        import sys
        import os

        # Give 0.3s for the HTTP response to be completely flushed to the client
        time.sleep(0.3)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        python_exe = sys.executable.replace("'", "''")
        escaped_dir = current_dir.replace("'", "''")

        # PowerShell command: wait 800ms for current socket to close, then launch uvicorn
        ps_cmd = (
            f"Start-Sleep -Milliseconds 800; "
            f"cd '{escaped_dir}'; "
            f"& '{python_exe}' -m uvicorn main:app --host 127.0.0.1 --port 8765"
        )

        subprocess.Popen(
            ["powershell", "-WindowStyle", "Hidden", "-Command", ps_cmd],
            cwd=current_dir,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)
        )
        time.sleep(0.1)
        os._exit(0)

    background_tasks.add_task(restart_process)
    return {"status": "ok", "message": "服务正在平滑重启中，请稍候..."}

@app.get("/api/logs")
def get_logs_endpoint(limit: int = 300):
    """Retrieve recent server logs for browser extension viewer"""
    recent = list(log_buffer)[-limit:]
    return {
        "status": "ok",
        "total": len(log_buffer),
        "logs": recent
    }

@app.post("/api/logs/clear")
def clear_logs_endpoint():
    """Clear server log buffer"""
    log_buffer.clear()
    now_str = datetime.datetime.now().strftime("%H:%M:%S")
    log_buffer.append(f"[{now_str}] [System] 🧹 运行日志已清空")
    return {"status": "ok", "message": "日志已清空"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8765, reload=False)
