import json
import os
import time
import urllib.request
import urllib.error
from config import load_config

def format_seconds(seconds: float) -> str:
    """Format seconds into MM:SS or HH:MM:SS"""
    s = int(seconds)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

def prepare_transcript_text(
    subtitles: list[dict],
    max_tokens_chars: int = None,
    chunk_interval_sec: float = 18.0
) -> str:
    """Condense subtitles into timestamped paragraphs with tighter intervals for high-precision seeking.
    When max_tokens_chars is None, no truncation occurs to guarantee complete video coverage.
    """
    if not subtitles:
        return "（暂无字幕记录）"

    lines = []
    last_ts = -999.0
    current_chunk = []
    current_start = 0.0

    for item in subtitles:
        start_sec = float(item.get("from", 0.0))
        content = item.get("content", "").strip()
        if not content:
            continue

        # Split on natural sentence ends or every ~15-20 seconds for fine-grained timestamp anchor
        has_ending_punct = content.endswith(('。', '！', '？', '.', '!', '?', '…'))
        time_diff = start_sec - last_ts

        if (time_diff >= chunk_interval_sec) or (time_diff >= 10.0 and has_ending_punct):
            if current_chunk:
                ts_str = format_seconds(current_start)
                lines.append(f"[{ts_str}](seek:{int(current_start)}) {' '.join(current_chunk)}")
                current_chunk = []
            current_start = start_sec
            last_ts = start_sec

        current_chunk.append(content)

    if current_chunk:
        ts_str = format_seconds(current_start)
        lines.append(f"[{ts_str}](seek:{int(current_start)}) {' '.join(current_chunk)}")

    full_text = "\n".join(lines)
    if max_tokens_chars and len(full_text) > max_tokens_chars:
        full_text = full_text[:max_tokens_chars] + "\n...(内容较长已在分层模式下深入全量覆盖)"
    return full_text

def build_chat_prompt(
    question: str,
    quote: str = "",
    video_title: str = "",
    summary_markdown: str = "",
    subtitles: list[dict] = None,
    history: list[dict] = None
) -> str:
    """Build high-context prompt for Q&A with full transcript and summary"""
    transcript_text = prepare_transcript_text(subtitles) if subtitles else "（暂无详细字幕）"
    
    prompt = f"""你是一位专业的视频伴读助手与知识问答导师。
用户正在观看或阅读以下视频的精炼总结，并对视频中的观点、论据或相关概念提出了问题。
请仔细结合视频信息、全文结构化总结以及原片全量带时间戳字幕，为用户提供客观准确、条理清晰、深入浅出的专业解答。

【视频基本信息】
标题：{video_title or '视频总结'}

【全文结构化总结】
{summary_markdown or '（暂无总结）'}

【原片字幕记录（带精确时间戳）】
{transcript_text}

---
【回答原则与要求】
1. **忠实原片与同行评审双重视角**：
   - 优先依据原片作者的论述因果、推演逻辑与事实数据展开透彻剖析；
   - **【事实边界与同行评审核验】**：若原片中涉及的某些观点、数据或结论存在明显的夸大、科学常识漏洞、偷换概念、以偏概全或已被权威学术界/官方明确证伪，必须在忠实解释原片逻辑的同时，主动、客观地标注其【事实边界与主流公认结论】（指出其前提漏洞或关键反例），帮助用户建立全面清醒的批判性认知，避免被片面信息误导；
   - 若用户询问专业概念，请提供准确定义并结合日常生活中的生动案例进行白话比喻，降低理解门槛；
   - 若用户询问观点是否有漏洞、局限或反方意见，请客观中立地分析其前提假设与边界。
2. **精准时间戳溯源**：
   - 当你的回答涉及视频原片中的具体论述、案例事实或数据时，**必须在对应文字后附带原片时间戳**，格式为标准 Markdown 链接形式：[MM:SS](seek:秒数)（例如 [03:15](seek:195)），以便用户点击直接跳转原视频对应画面核对；
   - 【严禁事项】：绝对严禁用反引号（`）包裹时间戳，严禁写成 `[03:15](seek:195)`，必须直接输出 [MM:SS](seek:195)；严禁直接输出任何 <a>、<span> 等原始 HTML 标签代码！
3. **输出排版**：
   - 使用规范的 Markdown 格式输出，重点词汇加粗，层次分明，无需多余开场白套话，直接直入主题展开解答。
"""
    if quote and quote.strip():
        prompt += f"\n【用户特别划选引用的内容】\n“{quote.strip()}”\n（请务必重点针对用户引用的这部分内容展开分析解答）\n"

    if history and len(history) > 0:
        prompt += "\n【上下文对话记录】\n"
        for turn in history[-8:]:
            r = "用户" if turn.get("role") == "user" else "AI助手"
            c = (turn.get("content") or turn.get("text") or "").strip()
            if c:
                prompt += f"{r}: {c}\n"

    prompt += f"\n用户当前提问：{question}\nAI导师解答："
    return prompt

def resolve_openai_endpoint(cfg: dict) -> tuple[str, str, str, str]:
    """Resolve (api_key, full_endpoint_url, model_name, provider_key)"""
    provider = cfg.get("ai_provider", "gemini")
    custom_key = (cfg.get("custom_api_key") or "").strip()
    custom_base = (cfg.get("custom_base_url") or "").strip()
    custom_model = (cfg.get("custom_model") or "").strip()

    defaults = {
        "deepseek": ("https://api.deepseek.com/v1", "deepseek-chat"),
        "openai": ("https://api.openai.com/v1", "gpt-4o-mini"),
        "siliconflow": ("https://api.siliconflow.cn/v1", "deepseek-ai/DeepSeek-V3"),
        "moonshot": ("https://api.moonshot.cn/v1", "moonshot-v1-8k"),
        "ollama": ("http://127.0.0.1:11434/v1", "deepseek-r1:8b"),
        "custom": ("https://api.deepseek.com/v1", "deepseek-chat")
    }

    def_base, def_model = defaults.get(provider, ("https://api.deepseek.com/v1", "deepseek-chat"))
    base_url = (custom_base or def_base).rstrip('/')
    model = custom_model or def_model

    if not base_url.endswith("/chat/completions"):
        full_url = f"{base_url}/chat/completions"
    else:
        full_url = base_url

    return custom_key, full_url, model, provider

def get_network_opener(url: str, proxy_url: str = ""):
    """Build urllib opener, skipping proxy for local addresses like 127.0.0.1 or localhost"""
    is_local = "127.0.0.1" in url or "localhost" in url
    if proxy_url and not is_local:
        handler = urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
        return urllib.request.build_opener(handler)
    return urllib.request.build_opener()

def call_openai_compatible_api(prompt: str, progress_callback=None) -> str:
    cfg = load_config()
    api_key, endpoint_url, model, provider = resolve_openai_endpoint(cfg)
    proxy_url = cfg.get("proxy_url", "")

    if provider != "ollama" and not api_key:
        raise ValueError(f"{provider.upper()} API Key 未配置，请在扩展「设置」中输入对应 Key！")

    if progress_callback:
        progress_callback(f"正在调用 {provider.upper()} ({model}) 生成思维导图报告...")

    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4
    }
    payload_bytes = json.dumps(payload).encode('utf-8')
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key if api_key else 'ollama'}"
    }

    req = urllib.request.Request(endpoint_url, data=payload_bytes, headers=headers)
    opener = get_network_opener(endpoint_url, proxy_url)

    try:
        print(f"[{provider} Summary API] 请求: {endpoint_url} (模型: {model})...")
        with opener.open(req, timeout=180) as resp:
            resp_body = resp.read().decode('utf-8', errors='replace')
            data = json.loads(resp_body)
            choices = data.get("choices", [])
            if not choices:
                raise RuntimeError(f"大模型未返回有效内容: {resp_body[:200]}")
            msg = choices[0].get("message", {})
            content = msg.get("content", "")
            if not content and msg.get("reasoning_content"):
                content = msg.get("reasoning_content")
            return content.strip()
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"[{provider} API] HTTP {e.code}: {err_msg}")
        raise RuntimeError(f"{provider} 调用失败 (HTTP {e.code}): {err_msg}")
    except Exception as e:
        print(f"[{provider} API] 异常: {e}")
        raise RuntimeError(f"{provider} 调用异常: {str(e)}")

def stream_openai_compatible_chat(prompt: str, model_override: str = None):
    cfg = load_config()
    api_key, endpoint_url, default_model, provider = resolve_openai_endpoint(cfg)
    model = model_override or default_model
    proxy_url = cfg.get("proxy_url", "")

    if provider != "ollama" and not api_key:
        raise ValueError(f"{provider.upper()} API Key 未配置，请在扩展「设置」中输入对应 Key！")

    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4,
        "stream": True
    }
    payload_bytes = json.dumps(payload).encode('utf-8')
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key if api_key else 'ollama'}"
    }

    req = urllib.request.Request(endpoint_url, data=payload_bytes, headers=headers)
    opener = get_network_opener(endpoint_url, proxy_url)

    try:
        print(f"[{provider} Chat Stream] 请求: {endpoint_url} (模型: {model})...")
        with opener.open(req, timeout=60) as resp:
            for line in resp:
                line_str = line.decode('utf-8', errors='replace')
                if line_str.startswith('data: '):
                    data_part = line_str[6:].strip()
                    if not data_part or data_part == '[DONE]':
                        break
                    try:
                        chunk_json = json.loads(data_part)
                        choices = chunk_json.get('choices', [])
                        if choices:
                            delta = choices[0].get('delta', {})
                            txt = delta.get('content') or delta.get('reasoning_content') or ''
                            if txt:
                                yield txt
                    except Exception:
                        pass
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"[{provider} Chat Stream] HTTP {e.code}: {err_msg}")
        raise RuntimeError(f"{provider} 问答中断 (HTTP {e.code}): {err_msg}")
    except Exception as e:
        print(f"[{provider} Chat Stream] 异常: {e}")
        raise RuntimeError(f"{provider} 问答连接异常: {str(e)}")

def resolve_anthropic_endpoint(cfg: dict) -> tuple[str, str, str]:
    """Resolve (api_key, full_endpoint_url, model_name) for Anthropic Claude"""
    api_key = (cfg.get("custom_api_key") or "").strip()
    custom_base = (cfg.get("custom_base_url") or "").strip()
    custom_model = (cfg.get("custom_model") or "").strip()

    base_url = (custom_base or "https://api.anthropic.com/v1").rstrip('/')
    if not base_url.endswith("/messages"):
        full_url = f"{base_url}/messages"
    else:
        full_url = base_url

    model = custom_model or "claude-3-5-sonnet-20241022"
    return api_key, full_url, model

def call_anthropic_api(prompt: str, progress_callback=None) -> str:
    cfg = load_config()
    api_key, endpoint_url, model = resolve_anthropic_endpoint(cfg)
    proxy_url = cfg.get("proxy_url", "")

    if not api_key:
        raise ValueError("Anthropic API Key 未配置，请在扩展「设置」中输入对应 Key (sk-ant-...)！")

    if progress_callback:
        progress_callback(f"正在调用 Anthropic Claude ({model}) 分析字幕并生成思维导图...")

    payload = {
        "model": model,
        "max_tokens": 4096,
        "temperature": 0.4,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    payload_bytes = json.dumps(payload).encode('utf-8')
    headers = {
        "content-type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }

    req = urllib.request.Request(endpoint_url, data=payload_bytes, headers=headers)
    opener = get_network_opener(endpoint_url, proxy_url)

    try:
        print(f"[Anthropic API] 请求: {endpoint_url} (模型: {model})...")
        with opener.open(req, timeout=180) as resp:
            resp_body = resp.read().decode('utf-8', errors='replace')
            data = json.loads(resp_body)
            content_list = data.get("content", [])
            full_text = "".join([c.get("text", "") for c in content_list if c.get("type") == "text"])
            if not full_text:
                raise RuntimeError(f"Claude 未返回有效文本: {resp_body[:200]}")
            return full_text.strip()
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"[Anthropic API] HTTP {e.code}: {err_msg}")
        raise RuntimeError(f"Anthropic 调用失败 (HTTP {e.code}): {err_msg}")
    except Exception as e:
        print(f"[Anthropic API] 异常: {e}")
        raise RuntimeError(f"Anthropic 调用异常: {str(e)}")

def stream_anthropic_chat(prompt: str, model_override: str = None):
    cfg = load_config()
    api_key, endpoint_url, default_model = resolve_anthropic_endpoint(cfg)
    model = model_override or default_model
    proxy_url = cfg.get("proxy_url", "")

    if not api_key:
        raise ValueError("Anthropic API Key 未配置，请在扩展「设置」中输入对应 Key (sk-ant-...)！")

    payload = {
        "model": model,
        "max_tokens": 4096,
        "temperature": 0.4,
        "stream": True,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    payload_bytes = json.dumps(payload).encode('utf-8')
    headers = {
        "content-type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }

    req = urllib.request.Request(endpoint_url, data=payload_bytes, headers=headers)
    opener = get_network_opener(endpoint_url, proxy_url)

    try:
        print(f"[Anthropic Chat Stream] 请求: {endpoint_url} (模型: {model})...")
        with opener.open(req, timeout=60) as resp:
            for line in resp:
                line_str = line.decode('utf-8', errors='replace')
                if line_str.startswith('data: '):
                    data_part = line_str[6:].strip()
                    if not data_part:
                        continue
                    try:
                        chunk_json = json.loads(data_part)
                        evt_type = chunk_json.get("type")
                        if evt_type == "content_block_delta":
                            delta = chunk_json.get("delta", {})
                            if delta.get("type") == "text_delta":
                                txt = delta.get("text", "")
                                if txt:
                                    yield txt
                        elif evt_type == "message_stop":
                            break
                    except Exception:
                        pass
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"[Anthropic Chat Stream] HTTP {e.code}: {err_msg}")
        raise RuntimeError(f"Anthropic 问答中断 (HTTP {e.code}): {err_msg}")
    except Exception as e:
        print(f"[Anthropic Chat Stream] 异常: {e}")
        raise RuntimeError(f"Anthropic 问答连接异常: {str(e)}")

def stream_gemini_chat(prompt: str, model: str = None):
    """Unified chat stream: automatically delegates to Gemini, Anthropic, or OpenAI-compatible provider"""
    cfg = load_config()
    provider = cfg.get("ai_provider", "gemini")
    if provider == "gemini":
        yield from _stream_gemini_chat_internal(prompt, model=model)
    elif provider == "anthropic":
        yield from stream_anthropic_chat(prompt, model_override=model)
    else:
        yield from stream_openai_compatible_chat(prompt, model_override=model)

stream_ai_chat = stream_gemini_chat

def _stream_gemini_chat_internal(prompt: str, model: str = None):
    """Stream response from Gemini API using multi-model fallback chain"""
    cfg = load_config()
    api_key = cfg.get("gemini_api_key", "").strip()
    primary_model = model or cfg.get("gemini_model", "gemini-3.5-flash-lite")
    proxy_url = cfg.get("proxy_url", "http://127.0.0.1:7897")

    if not api_key:
        raise ValueError("Gemini API Key 未配置，请在设置中输入 API Key")

    # 按照模型性能强度梯队构建容灾链：严格优先调用用户配置的主模型，遇 503/429 繁忙时按性能梯队依次接班
    candidate_order = [
        'gemini-3.5-flash-lite',  # 高配额轻量主力
        'gemini-3.8-flash',       # 梯队一：高推理旗舰
        'gemini-3.6-flash',       # 梯队二：高稳定性 Flash
        'gemini-3.5-flash',       # 梯队三：主力通用 Flash
        'gemini-3-flash-preview', # 梯队四：基石 Flash 模型
        'gemini-3.1-flash-lite'   # 梯队五：极速高配额兜底
    ]

    chain = [primary_model] if primary_model else ['gemini-3.5-flash-lite']
    for backup in candidate_order:
        if backup not in chain:
            chain.append(backup)

    if proxy_url:
        handler = urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
        opener = urllib.request.build_opener(handler)
    else:
        opener = urllib.request.build_opener()

    last_error = None
    for idx, model_name in enumerate(chain):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 4096
            }
        }
        payload_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=payload_data, headers={"Content-Type": "application/json"})

        try:
            print(f"[Gemini Chat Stream] 尝试模型: {model_name}...")
            with opener.open(req, timeout=30) as resp:
                yielded_any = False
                for line in resp:
                    line_str = line.decode('utf-8', errors='replace')
                    if line_str.startswith('data: '):
                        data_part = line_str[6:].strip()
                        if not data_part or data_part == '[DONE]':
                            continue
                        try:
                            chunk_json = json.loads(data_part)
                            candidates = chunk_json.get('candidates', [])
                            if candidates:
                                parts = candidates[0].get('content', {}).get('parts', [])
                                for p in parts:
                                    t = p.get('text', '')
                                    if t:
                                        yielded_any = True
                                        yield t
                        except Exception:
                            pass
                if yielded_any:
                    return
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            print(f"[Gemini Chat Stream] {model_name} (HTTP {e.code}): {err_body}")
            last_error = f"{model_name} ({e.code})"
            continue
        except Exception as e:
            print(f"[Gemini Chat Stream] {model_name} 异常: {e}")
            last_error = str(e)
            continue

    raise RuntimeError(f"Gemini 所有模型均调用失败: {last_error}")

def call_gemini_api(prompt: str, model: str = None, progress_callback=None) -> str:
    """Call Google Gemini API with smart multi-model fallback chain against 503 spikes"""
    cfg = load_config()
    api_key = cfg.get("gemini_api_key", "").strip()
    primary_model = model or cfg.get("gemini_model", "gemini-3.5-flash")
    proxy_url = cfg.get("proxy_url", "http://127.0.0.1:7897")

    if not api_key:
        raise ValueError("Gemini API Key 未配置，请在设置中输入 API Key")

    # 按照模型性能强度梯队构建容灾降级模型链：严格优先调用用户配置的主模型，遇 503/429 繁忙时按梯队无缝接班
    candidate_order = [
        'gemini-3.5-flash-lite',  # 高配额轻量主力 (15 RPM / 500 RPD)
        'gemini-3.8-flash',       # 梯队一：高推理性能旗舰
        'gemini-3.6-flash',       # 梯队二：高稳定性 Flash
        'gemini-3.5-flash',       # 梯队三：主力通用 Flash
        'gemini-3-flash-preview', # 梯队四：基石 Flash 模型
        'gemini-3.1-flash-lite'   # 梯队五：极速高配额兜底
    ]

    chain = [primary_model] if primary_model else ['gemini-3.5-flash-lite']
    for backup in candidate_order:
        if backup not in chain:
            chain.append(backup)

    if proxy_url:
        handler = urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
        opener = urllib.request.build_opener(handler)
    else:
        opener = urllib.request.build_opener()

    last_error = None
    for idx, model_name in enumerate(chain):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 8192
            }
        }
        payload_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=payload_data, headers={"Content-Type": "application/json"})

        # 每个模型尝试调用，遇 503 繁忙直接无缝切到下一个模型
        try:
            print(f"[Gemini] 正在调用模型: {model_name}...")
            with opener.open(req, timeout=30) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                candidates = data.get('candidates', [])
                if not candidates:
                    raise RuntimeError("Gemini 返回空候选内容")
                parts = candidates[0].get('content', {}).get('parts', [])
                reply = "".join(p.get('text', '') for p in parts)
                if reply.strip():
                    print(f"[Gemini] 调用成功，使用模型: {model_name}")
                    return reply.strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            last_error = f"{model_name} (HTTP {e.code}): {err_body}"
            # 503 繁忙、429 超限、404 不存在时，自动触发降级
            if e.code in [503, 429, 404]:
                next_model = chain[idx + 1] if idx + 1 < len(chain) else "无"
                print(f"[Gemini] {model_name} 返回 HTTP {e.code}（服务器繁忙），自动切往备选模型: {next_model}")
                if progress_callback and idx + 1 < len(chain):
                    progress_callback(f"提示：{model_name} 高峰繁忙(503)，已自动为您无缝切换至 {next_model} 提炼中...")
                time.sleep(0.5)
                continue
        except Exception as e:
            last_error = f"{model_name}: {str(e)}"
            next_model = chain[idx + 1] if idx + 1 < len(chain) else "无"
            print(f"[Gemini] {model_name} 调用异常 ({e})，切换备用: {next_model}")
            if progress_callback and idx + 1 < len(chain):
                progress_callback(f"提示：网络稍有波动，正在自动切换备选模型 {next_model}...")
            time.sleep(0.5)
            continue

    raise RuntimeError(f"Gemini 所有模型均调用失败 (请检查 Clash 代理是否开启): {last_error}")

def call_ai_api(prompt: str, model: str = None, progress_callback=None) -> str:
    """Unified API call: automatically routes to Gemini, Anthropic, or OpenAI-compatible provider"""
    cfg = load_config()
    provider = cfg.get("ai_provider", "gemini")
    if provider == "gemini":
        return call_gemini_api(prompt, model=model, progress_callback=progress_callback)
    elif provider == "anthropic":
        return call_anthropic_api(prompt, progress_callback=progress_callback)
    else:
        return call_openai_compatible_api(prompt, progress_callback=progress_callback)

def split_subtitles_into_segments(
    subtitles: list[dict],
    target_segment_duration: float = 720.0,
    max_chars_per_segment: int = 14000
) -> list[list[dict]]:
    """Split subtitles into temporally and semantically coherent segments (approx 10-15 minutes or 12k-14k chars).
    Guarantees 100% of subtitles are preserved with zero mid-sentence cuts.
    """
    if not subtitles:
        return []

    segments = []
    current_seg = []
    current_seg_chars = 0
    seg_start_time = float(subtitles[0].get("from", 0.0))

    for item in subtitles:
        t_from = float(item.get("from", 0.0))
        c = item.get("content", "").strip()
        c_len = len(c)

        seg_duration = t_from - seg_start_time
        if current_seg and (seg_duration >= target_segment_duration or (current_seg_chars + c_len) > max_chars_per_segment):
            segments.append(current_seg)
            current_seg = [item]
            current_seg_chars = c_len
            seg_start_time = t_from
        else:
            current_seg.append(item)
            current_seg_chars += c_len

    if current_seg:
        segments.append(current_seg)

    return segments

def extract_segment_arguments(
    segment_subtitles: list[dict],
    seg_index: int,
    total_segs: int,
    metadata: dict,
    progress_callback=None
) -> str:
    """Stage 1 for Long Knowledge Videos: Extract structured argumentative notes for this chapter"""
    start_sec = segment_subtitles[0].get("from", 0.0)
    end_sec = segment_subtitles[-1].get("to", 0.0)
    start_str = format_seconds(start_sec)
    end_str = format_seconds(end_sec)
    title = metadata.get("title", "未知视频")
    author = metadata.get("author", "未知作者")

    if progress_callback:
        progress_callback(f"🧠 [长视频深度解析 1/2] 正在提炼第 {seg_index}/{total_segs} 章节论证链条 [{start_str} - {end_str}]...")

    seg_transcript = prepare_transcript_text(segment_subtitles, chunk_interval_sec=16.0)

    prompt = f"""你是一位认知科学与学术论证分析专家。
当前正在深度分析知识长视频《{title}》（作者：{author}）的第 {seg_index}/{total_segs} 章节字幕记录（时间区间：{start_str} 至 {end_str}）。
请仔细研读本章节原始字幕，提炼本章节的核心【论证结构与实证支撑材料】。
严禁浮于表面的AI文学化修饰，严禁丢失原片推论逻辑，严禁捏造不存在的事实。

【本章节字幕记录】
{seg_transcript}

---
请严格按以下结构输出本章节的论证笔记（Markdown 格式）：

### 章节 {seg_index}：[{start_str} - {end_str}](seek:{int(start_sec)}) 议题推进
* **1. 核心论题与立论主张**：
  - 本段作者提出了什么核心命题、核心观点或假说？立论的出发点与解决的痛点是什么？
* **2. 论证推演链条与支撑材料**（必须附带精准时间戳）：
  - 核心逻辑递进：作者是如何一步步剖析论证的？前后因果链条是什么？
  - 关键论据与实证材料：原片引用了哪些具体数据、科学实验、历史案例、文献理论或技术机制？请务必在关键实证后标明时间戳 `[MM:SS](seek:秒数)`。
* **3. 反例、对立观点与限制边界**：
  - 本段是否讨论了反例、对立学派的质疑、实验局限或适用边界？作者对此是如何辩护或界定的？（若本段未显式讨论反例，则写“本段聚焦基础立论，未显式讨论反例”）
* **4. 本段核心概念/专业术语**：
  - 列出本段界定的关键专有名词及作者赋予的特定语境含义（若无专有名词则填“无”）。
"""
    return call_ai_api(prompt, progress_callback=progress_callback)

def synthesize_global_knowledge_report(
    segment_notes: list[str],
    metadata: dict,
    progress_callback=None
) -> str:
    """Stage 2 for Long Knowledge Videos: Synthesize all chapter notes into global argument report and Markmap"""
    title = metadata.get("title", "未知视频")
    author = metadata.get("author", "未知作者")
    video_url = metadata.get("url", "")
    sub_source = metadata.get("sub_source", "自动检测")

    if progress_callback:
        progress_callback("🎯 [长视频深度解析 2/2] 正在全局整合跨章节论证网络与交互导图...")

    combined_notes = "\n\n".join(segment_notes)

    prompt = f"""你是一位专业的知识提炼专家与结构化思维导图架构师。
我们已经对知识长视频《{title}》（作者：{author}）的各章节完成了全量、无遗漏的分段论证提取。
以下是全片所有章节的【深度论证笔记】：

{combined_notes}

---
【全篇综合任务与要求】
请你基于上述各章节完整材料，站在全局视角，为学习者撰写一份忠实还原原片论证结构、极具学习与研究价值的深度报告与思维导图。

【核心原则】：
1. **保留作者原本的论证结构**：忠实还原原作者从前提出发、展开论据、引入反例、最终得出结论的推演脉络，严禁将其粗暴打碎成千篇一律的散乱要点；
2. **严格事实归属与边界标注**：
   - 明确区分【作者的主张与推论】与【作者引用的实证数据】；
   - 对有争议、绝对化或特殊假设的推论，客观指出其前提条件；
3. **精准保留所有时间戳**：必须将各章节笔记中的精确时间戳标记 `[MM:SS](seek:秒数)` 完整继承到报告中，方便读者指哪看哪；严禁使用反引号包裹时间戳，严禁使用 HTML 标签。

请严格使用纯 Markdown 格式输出以下内容：

---
title: "{title}"
author: "{author}"
url: "{video_url}"
date: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
source: "{sub_source}（长视频分层全景重构）"
---

# {title}

## 💡 一句话主旨
（用 1~2 句话精准概括全片贯穿的核心论题与作者最终给出的定论，100% 忠实于原片）

## 🎯 全景论证脉络与核心深度洞见
（全面整合各章节笔记，按原片逻辑演进顺序自然展开。议题数量完全由原片实际讨论的独立主题决定，长视频讨论了多少个核心议题就完整输出多少条，严禁遗漏任何章节的核心推论！格式如下）：

* **1. 【核心议题或论题推进概括】**
  * **原片讲述逻辑与论证推演**：
    （篇幅 200~400 字，详尽剖析作者的推演脉络）：
    - **背景与论题引入**：作者是在什么背景下探讨此问题的？面临怎样的理论或现实困境？
    - **推演机制与因果链条**：作者是如何层层剖析的？前后的因果逻辑是什么？
    - **支撑论据与实证材料**：原片引用了哪些关键数据、实验、历史案例或理论？每个关键实证必须附带原片时间戳 `[MM:SS](seek:秒数)`。
  * **对立观点、反例与适用边界**（有则详述，无则标明“作者未显式展开反例”）：
    - 原片是否讨论了反例、替代解释或局限性？作者对此作何回应？
  * **术语与概念解析**（严格按需输出，若有专有名词则按专业与通俗双层解析，无则完全不写此项）：
    * **【概念名】**：
      * **学术/专业定义**：...
      * **通俗大白话比喻**：...

（自然依序输出第 2、第 3 ... 直至第 N 个核心论点板块，穷尽全片所有章节的重要推论）

## ⚖️ 认知边界与事实核验提示
（【严谨学术与客观认知视角】：
- 明确标注：原片中的核心结论是建立在哪些特定假设、样本范围或学派立场之上的？
- 若原片涉及争议性强的数据引用或单方推论，用引用块明确标注【事实核验提示】，提醒学习者需参考同行评审或第一手文献进一步核实，绝不将作者的主观推论直接当作无可争议的绝对真理）

## 🧠 脉络思维导图
（深度融合全片时序演进与逻辑证明树。格式严格包裹在 ```markmap 和 ``` 代码块中。
- 一级分支（##）严格对应视频各章节主题推进与阶段；
- 每个阶段起始标注时间戳 `[MM:SS](seek:秒数)`；
- 二级与三级分支呈现核心论点、论据与反驳；
- 严禁出现任何 HTML 标签，所有跳转标记统一为纯 Markdown 格式：`[MM:SS](seek:秒数)`；
- 严禁机械重复时间戳。）
```markmap
# {title}
## 第一阶段：... [00:00](seek:0)
- 核心命题 A
  - 关键支撑论据 [03:15](seek:195)
  - 反例辨析与回应
## 第二阶段：... [15:20](seek:920)
- 核心命题 B
  - 实证推演机制 [18:40](seek:1120)
## （按全片所有章节自然延伸完整导图树...）
```
"""
    return call_ai_api(prompt, progress_callback=progress_callback)

def generate_video_summary(subtitles: list[dict], metadata: dict, progress_callback=None) -> str:
    """Generate Markdown summary + Markmap structure using active AI provider.
    Automatically applies Hierarchical Epistemic Reconstruction for Long Knowledge Videos.
    """
    cfg = load_config()
    provider = cfg.get("ai_provider", "gemini")
    provider_names = {
        "gemini": "Gemini",
        "anthropic": "Claude",
        "deepseek": "DeepSeek",
        "openai": "OpenAI",
        "siliconflow": "硅基流动",
        "moonshot": "Kimi",
        "ollama": "Ollama",
        "custom": "AI"
    }
    p_name = provider_names.get(provider, "AI")

    # Calculate video metrics to determine knowledge long video mode
    duration = 0.0
    if subtitles:
        duration = float(subtitles[-1].get("to", 0.0))
    total_chars = sum(len(s.get("content", "")) for s in subtitles)

    # Trigger hierarchical multi-stage comprehension for knowledge long videos
    # (duration >= 25 minutes or total characters >= 20,000 chars)
    is_long_video = duration >= 1500.0 or total_chars >= 20000

    if is_long_video and len(subtitles) >= 60:
        if progress_callback:
            progress_callback(f"📚 检测到深度知识长视频 (时长约 {format_seconds(duration)}，共 {total_chars} 字)，已启动【分层论证重构】长文本引擎...")

        segments = split_subtitles_into_segments(subtitles, target_segment_duration=720.0, max_chars_per_segment=13000)
        total_segs = len(segments)

        if total_segs > 1:
            segment_notes = []
            for i, seg in enumerate(segments, start=1):
                note = extract_segment_arguments(seg, i, total_segs, metadata, progress_callback)
                segment_notes.append(note)

            return synthesize_global_knowledge_report(segment_notes, metadata, progress_callback)

    # Standard / Shorter Videos: Single-pass high-density Epistemic Argument Extraction (Zero Truncation)
    if progress_callback:
        progress_callback("正在整理字幕上下文与高精度时间戳...")

    transcript_text = prepare_transcript_text(subtitles, max_tokens_chars=None, chunk_interval_sec=18.0)
    title = metadata.get("title", "未知视频")
    author = metadata.get("author", "未知UP主/作者")
    video_url = metadata.get("url", "")
    sub_source = metadata.get("sub_source", "自动检测")

    prompt = f"""你是一位专业的知识提炼专家与结构化思维导图架构师。
请你仔细阅读以下视频的字幕记录（带精确时间戳），为读者撰写一份结构精炼、忠实还原原片论证逻辑的报告与思维导图。

【视频基本信息】
* 标题：{title}
* UP主 / 作者：{author}
* 视频链接：{video_url}
* 字幕来源：{sub_source}

【字幕内容记录】
{transcript_text}

---

【任务与输出格式要求】
请严格使用纯 Markdown 格式输出以下内容，严禁出现任何非标准标签。板块标题必须保持干净：

---
title: "{title}"
author: "{author}"
url: "{video_url}"
date: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
source: "{sub_source}"
---

# {title}

## 💡 一句话主旨
（用 1~2 句话精准概括视频作者表达的核心论点或最终结论，100% 忠实于原视频）

## 🎯 全景论证脉络与核心深度洞见
（【重要·内容自适应与论证忠实原则】：
* 深入还原原片讨论的核心议题与推演逻辑；
* 严禁机械拼凑或遗漏关键论据，根据原片体量自然呈现全部论点板块）：

* **1. 【核心论点或议题概括】**
  * **原片讲述逻辑与推演链条**：
    （篇幅 150~350 字，完整还原作者的因果论证链条）：
    - **背景与问题引入**：作者是在什么背景下提出该议题的？面临什么核心痛点或理论交锋？
    - **因果机制与逻辑展开**：作者是如何一步步剖析论证的？
    - **支撑论据与实证材料**：原片引用了哪些具体数据、案例、历史事件或科学实验？必须在关键实证后附带时间戳 `[MM:SS](seek:秒数)`。
  * **反例、对立观点与限制条件**（若原片有讨论则详述，若纯单向科普则标明“作者未展开反例”）：
    - 原片是否讨论了反例、局限性或外部质疑？作者如何回应？
  * **术语解析**（严格按需输出，若无专业术语则完全不输出此项；若有则全部列出）：
    * **【术语名称】**：
      * **专业定义**：严谨的行业/学术标准定义。
      * **通俗解读**：生动易懂的大白话比喻或生活实例。

（根据视频实际包含的主题体量，自然依次输出第 2、第 3 ... 直至第 N 个核心要点）

## ⚖️ 认知边界与事实核验提示
（客观标注：作者推论的前提假设、适用范围；若涉及争议性数据或主观断言，标明【事实核验提示】，提醒读者参考同行评审进一步核实）

## 🧠 脉络思维导图
（深度融合全片时序进展与逻辑证明树。格式严格包裹在 ```markmap 和 ``` 代码块中。
- 一级分支（##）严格对应视频实际讨论的每一个核心阶段；
- 每个阶段起始标注时间戳 `[MM:SS](seek:秒数)`；
- 严禁出现任何 HTML 标签，所有跳转标记统一为纯 Markdown 格式：`[MM:SS](seek:秒数)`；
- 严禁在子要点机械重复粘贴相同的时间戳。）
```markmap
# {title}
## 主题阶段一 [00:00](seek:0)
- 关键议题要点 A
  - 核心论据与支撑细节 [01:30](seek:90)
- 关键议题要点 B [03:15](seek:195)
  - 机制推演
## 主题阶段二 [08:30](seek:510)
- 关键议题要点 C
  - 核心案例 [12:00](seek:720)
## （按原片实际内容，自然延伸后续所有分支...）
```

【核心原则】
1. 绝对忠实于原视频论证逻辑，绝不凭空捏造未提及的启示；
2. 彻底去除口头禅与废话，转换为书面化精炼表达；
3. 时间戳精准标注在论据出现处，严禁包裹反引号，严禁 HTML 标签；
4. 严格保持认知边界标注，区分作者立场与客观公认事实。
"""

    if progress_callback:
        progress_callback(f"{p_name} 正在深度解析论证逻辑并生成结构化导图...")

    result = call_ai_api(prompt, progress_callback=progress_callback)
    return result
