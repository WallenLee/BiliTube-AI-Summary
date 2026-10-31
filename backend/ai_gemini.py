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

def prepare_transcript_text(subtitles: list[dict], max_tokens_chars: int = 150000) -> str:
    """Condense subtitles into timestamped paragraphs to optimize token density"""
    lines = []
    last_ts = -999.0
    current_chunk = []
    current_start = 0.0

    for item in subtitles:
        start_sec = item.get("from", 0.0)
        content = item.get("content", "").strip()
        if not content:
            continue

        # Group lines every 30-45 seconds or after punctuation
        if start_sec - last_ts > 35.0:
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
    # Truncate if insanely huge, though Gemini has 1M context
    if len(full_text) > max_tokens_chars:
        full_text = full_text[:max_tokens_chars] + "\n...(后半部分字幕较长已节选)"
    return full_text

def call_gemini_api(prompt: str, model: str = None, progress_callback=None) -> str:
    """Call Google Gemini API with smart multi-model fallback chain against 503 spikes"""
    cfg = load_config()
    api_key = cfg.get("gemini_api_key", "").strip()
    primary_model = model or cfg.get("gemini_model", "gemini-3.5-flash")
    proxy_url = cfg.get("proxy_url", "http://127.0.0.1:7897")

    if not api_key:
        raise ValueError("Gemini API Key 未配置，请在设置中输入 API Key")

    # 构建容灾降级模型链：首选模型优先，遇 503 高峰排队时自动秒切备选池
    chain = [primary_model]
    for backup in ['gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']:
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

def generate_video_summary(subtitles: list[dict], metadata: dict, progress_callback=None) -> str:
    """Generate Markdown summary + Markmap structure using Gemini"""
    if progress_callback:
        progress_callback("正在整理字幕上下文与时间戳...")

    transcript_text = prepare_transcript_text(subtitles)
    title = metadata.get("title", "未知视频")
    author = metadata.get("author", "未知UP主/作者")
    video_url = metadata.get("url", "")
    sub_source = metadata.get("sub_source", "自动检测")

    prompt = f"""你是一位专业的知识提炼专家与结构化思维导图架构师。
请你仔细阅读以下视频的字幕记录（带时间戳），为读者撰写一份结构精炼、忠实还原原片事实的视频总结报告与思维导图结构。

【视频基本信息】
* 标题：{title}
* UP主 / 作者：{author}
* 视频链接：{video_url}
* 字幕来源：{sub_source}

【字幕内容记录】
{transcript_text}

---

【任务与输出格式要求】
请严格使用纯 Markdown 格式输出以下三个板块，严禁出现任何非标准标签。板块标题必须保持干净，严禁携带任何括号或补充后缀：

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

## 🎯 核心深度洞见
（提炼 3~5 个核心要点。严格忠实原片内容，严禁自己增补任何主观发散的外部建议。每个洞见必须深入透彻，严禁浮于表面！）
* **1. 【核心论点概括】**
  * **原片讲述逻辑**：
    （必须详实深入展开，严禁一两句话草率概括！篇幅建议 150~300 字，完整还原作者的论证链条）：
    - **背景与痛点**：作者是在什么背景下提出该观点的？指出了现实中的什么矛盾或问题？
    - **推演脉络与机制**：作者是如何一步步剖析论证的？前后的核心因果逻辑与运作机制是什么？原片引用了哪些关键数据、具体案例、历史事件或现实细节来有力支撑该论点？
  * **术语解析**（严格按需输出，宁缺毋滥，有则全列）：
    【重要规则】：
    - 仅当本段确实涉及真正的专有名词、行业黑话、政策术语或专业英文缩写时，才输出此项；若无专业术语，则【完全不输出“术语解析”这一栏】，严禁生拉硬凑解释日常词汇！
    - 若出现专业术语，必须全部穷尽列出（有几个解释几个，不可遗漏），每个术语均按以下格式提供专业与通俗双层解析：
      * **【术语一名称】**：
        * **专业定义**：准确、严谨的行业/学术标准定义。
        * **通俗解读**：生动易懂的大白话比喻或说明，降低认知门槛。
      * **【术语二名称】**（若有）：
        * **专业定义**：...
        * **通俗解读**：...

* **2. 【核心论点概括】**
  * **原片讲述逻辑**：（同样按“背景与痛点 ➔ 推演脉络与机制（含事实案例与数据论据）”完整详尽展开）
  * **术语解析**（有则全列，无则不写）：...

* **3. 【核心论点概括】**
  * **原片讲述逻辑**：（同样按“背景与痛点 ➔ 推演脉络与机制（含事实案例与数据论据）”完整详尽展开）
  * **术语解析**（有则全列，无则不写）：...

## 🧠 脉络思维导图
（深度融合全片时序进展与逻辑层次，将时间线与思维导图合二为一。格式严格包裹在 ```markmap 和 ``` 代码块中。
【时间戳精简与纯净规则（极其重要）】：
1. 严禁出现任何 HTML 标签（如 <a>、<span>、class 等），所有跳转标记统一为纯 Markdown 格式：`[MM:SS](seek:秒数)`。
2. 【时间戳只在关键阶段转折处标注，绝不机械堆砌】：
   - 仅在每个大阶段的起始（如 `## 1. 主题名称 [00:00](seek:0)`）或出现明显时间推进的关键要点后标注时间戳；
   - 绝对严禁在子要点、数据论据、案例细节后面机械重复复制粘贴相同的时间戳（例如严禁一连串每个小点都带 [00:00](seek:0)）！
   - 没有新时间点的子分支末尾保持纯文本，严禁添加任何多余时间标记！）
```markmap
# {title}
## 1. 阶段或主题名称 [00:00](seek:0)
- 关键要点 A
  - 核心论据与案例数据
- 关键要点 B [03:15](seek:195)
  - 细分事实论证
## 2. 阶段或主题名称 [05:30](seek:330)
- 关键要点 C
  - 核心论据与机制推演 [07:20](seek:440)
## 3. 阶段或主题名称 [10:20](seek:620)
- 总结与最终结论 [11:45](seek:705)
```

【核心原则】
1. 绝对忠实于原视频事实，绝不凭空捏造未提及的启示或建议；
2. 彻底去除口头禅与口语废话，转换为书面化精炼表达；
3. 【术语解析按需且穷尽】：只有真正包含专业术语时才写，没有绝不强写；一旦有，必须全部列出（有几个写几个），且严格保持“专业定义 + 通俗解读”双层解析；
4. 【讲述逻辑严禁简略】“原片讲述逻辑”是全文最具含金量的部分，必须完整展现作者的论证厚度，将“因果机制推演”与“关键事实数据/案例”紧密结合融为一体，做到论点扎实、脉络连贯、细节丰富；
5. 【纯净导图】：思维导图严格包裹在 ```markmap 和 ``` 中，严禁任何 HTML 代码泄露；时间戳只在真正推进时标注，严禁在子点机械重复堆砌相同时间戳。
"""

    if progress_callback:
        progress_callback("Gemini 正在深度阅读字幕并生成思维导图...")

    result = call_gemini_api(prompt, progress_callback=progress_callback)
    return result
