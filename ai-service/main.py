from fastapi import FastAPI
from pydantic import BaseModel
import httpx, json, re
import csv
import time  
from datetime import datetime

app = FastAPI()

OLLAMA_URL = "http://ollama:11434/api/generate"
MODEL = "mistral"

class AuditData(BaseModel):
    job_id: str
    url: str
    global_score: int | None = None
    seo_anomalies: list = []
    perf_anomalies: list = []
    sec_anomalies: list = []
    analyses: list = ["seo_tech", "performance", "security"]

def format_as_paragraph(text: str) -> str:
    try:
        clean = text.strip()
        json_match = re.search(r'\[.*\]', clean, re.DOTALL)
        if json_match:
            items = json.loads(json_match.group())
            if isinstance(items, list):
                paragraphs = []
                current_category = ""
                for item in items:
                    cat = item.get("category", "")
                    if cat != current_category:
                        current_category = cat
                        paragraphs.append(f"\n{cat}\n")
                    title = item.get("title", "")
                    desc = item.get("description", "")
                    paragraphs.append(f"{title}. {desc}")
                return "\n\n".join(paragraphs).strip()
    except:
        pass
    return text

def remove_unwanted_sections(
    text: str,
    has_seo: bool,
    has_perf: bool,
    has_sec: bool
) -> str:
    lines = text.split("\n")
    result = []
    skip = False

    for line in lines:
        stripped = line.strip()

        # Detect section headings and decide whether to keep them
        if stripped.startswith("### SEO"):
            skip = not has_seo

        elif stripped.startswith("### Performance"):
            skip = not has_perf

        elif (
            stripped.startswith("### Securite")
            or stripped.startswith("### Sécurité")
        ):
            skip = not has_sec

        elif (
            stripped.startswith("### Conclusion")
            or stripped.startswith("### Rapport")
        ):
            skip = False

        if not skip:
            result.append(line)

    return "\n".join(result)

def print_client_analysis(data: AuditData):
    """Print detailed information about the client's analysis request"""
    print("\n" + "="*60)
    print("📋 CLIENT ANALYSIS REQUEST")
    print("="*60)
    
    # Basic information
    print(f"\n📌 Job ID: {data.job_id}")
    print(f"🌐 URL: {data.url}")
    print(f"⭐ Global Score: {data.global_score if data.global_score is not None else 'Not provided'}/100")
    
    # Requested analyses
    print(f"\n🔍 Requested Analyses: {len(data.analyses)} item(s)")
    print("-" * 40)
    for idx, analysis in enumerate(data.analyses, 1):
        analysis_display = {
            "seo_tech": "🔎 SEO Technical",
            "seo": "🔎 SEO",
            "performance": "⚡ Performance",
            "security": "🔒 Security"
        }.get(analysis, f"❓ {analysis}")
        print(f"  {idx}. {analysis_display}")
    
    # Show which sections will be generated (only those with issues AND requested)
    print("\n📄 Sections to be generated:")
    print("-" * 40)
    
    has_seo = ("seo_tech" in data.analyses or "seo" in data.analyses) and len(data.seo_anomalies) > 0
    has_perf = "performance" in data.analyses and len(data.perf_anomalies) > 0
    has_sec = "security" in data.analyses and len(data.sec_anomalies) > 0
    
    print(f"  {'✓' if has_seo else '✗'} SEO section {'(no issues found)' if not has_seo and ('seo_tech' in data.analyses or 'seo' in data.analyses) else ''}")
    print(f"  {'✓' if has_perf else '✗'} Performance section {'(no issues found)' if not has_perf and 'performance' in data.analyses else ''}")
    print(f"  {'✓' if has_sec else '✗'} Security section {'(no issues found)' if not has_sec and 'security' in data.analyses else ''}")
    
    # Anomalies summary
    print("\n⚠️ Detected Anomalies:")
    print("-" * 40)
    
    seo_count = len(data.seo_anomalies)
    perf_count = len(data.perf_anomalies)
    sec_count = len(data.sec_anomalies)
    
    print(f"  SEO anomalies: {seo_count} issue(s)")
    if seo_count > 0 and seo_count <= 5:
        print(f"    └─ {data.seo_anomalies}")
    elif seo_count > 5:
        print(f"    └─ {data.seo_anomalies[:5]} ... and {seo_count - 5} more")
    
    print(f"  Performance anomalies: {perf_count} issue(s)")
    if perf_count > 0 and perf_count <= 5:
        print(f"    └─ {data.perf_anomalies}")
    elif perf_count > 5:
        print(f"    └─ {data.perf_anomalies[:5]} ... and {perf_count - 5} more")
    
    print(f"  Security anomalies: {sec_count} issue(s)")
    if sec_count > 0 and sec_count <= 5:
        print(f"    └─ {data.sec_anomalies}")
    elif sec_count > 5:
        print(f"    └─ {data.sec_anomalies[:5]} ... and {sec_count - 5} more")
    
    # Summary
    print("\n📊 Summary:")
    print("-" * 40)
    sections_count = sum([has_seo, has_perf, has_sec])
    anomalies_count = seo_count + perf_count + sec_count
    print(f"  • Total sections requested: {len(data.analyses)}/3")
    print(f"  • Total sections with issues: {sections_count}/3")
    print(f"  • Total anomalies detected: {anomalies_count}")
    
    # Show skipped sections
    skipped_sections = []
    if "seo_tech" in data.analyses or "seo" in data.analyses:
        if seo_count == 0:
            skipped_sections.append("SEO")
    if "performance" in data.analyses:
        if perf_count == 0:
            skipped_sections.append("Performance")
    if "security" in data.analyses:
        if sec_count == 0:
            skipped_sections.append("Security")
    
    if skipped_sections:
        print(f"\n⏭️  Skipped sections (no issues found): {', '.join(skipped_sections)}")
    
    # Configuration
    print(f"\n⚙️ Configuration:")
    print("-" * 40)
    print(f"  • Model: {MODEL}")
    print(f"  • Ollama URL: {OLLAMA_URL}")
    print(f"  • Temperature: 0.3")
    print(f"  • Max tokens: 8000")
    
    print("\n" + "="*60 + "\n")

def build_prompt(data: AuditData) -> str:
    # Only include sections that are requested AND have anomalies
    has_seo = ("seo_tech" in data.analyses or "seo" in data.analyses) and len(data.seo_anomalies) > 0
    has_perf = "performance" in data.analyses and len(data.perf_anomalies) > 0
    has_sec = "security" in data.analyses and len(data.sec_anomalies) > 0

    # Build detected issues section (only include if there are issues)
    issues_lines = []
    if has_seo and data.seo_anomalies:
        issues_lines.append(f"- SEO Issues: {data.seo_anomalies}")
    if has_perf and data.perf_anomalies:
        issues_lines.append(f"- Performance Issues: {data.perf_anomalies}")
    if has_sec and data.sec_anomalies:
        issues_lines.append(f"- Security Issues: {data.sec_anomalies}")

    issues_text = "\n".join(issues_lines) if issues_lines else "- No issues detected"

    # Build active sections list for the prompt (only those with anomalies)
    active_sections = []
    if has_seo:  active_sections.append("SEO")
    if has_perf: active_sections.append("Performance")
    if has_sec:  active_sections.append("Sécurité")

    # If no sections have anomalies, return a simple response
    if not any([has_seo, has_perf, has_sec]):
        return f"""You are a senior web audit consultant writing an official audit report for a client.

Website audited: {data.url}
Global Score: {data.global_score}/100

Analyses performed: {", ".join(data.analyses)}

Detected issues: No issues were found in any of the requested analyses.

Write a short professional audit report in French that:
1. Acknowledges that no issues were detected
2. Congratulates the client on maintaining good practices
3. Suggests to continue monitoring and maintaining the current standards
4. Provides general recommendations for keeping the website healthy

IMPORTANT FORMATTING RULES:
- Start directly with "### Rapport d'Audit - [website name]"
- Write in professional flowing paragraphs in French
- Leave a blank line between each paragraph
- Use ONLY plain text - no hyperlinks, no URLs, no web addresses
- Write complete explanations without referring to external resources
- Do NOT use bullet points or numbered lists
- Keep the report concise and positive
"""

    # Build dynamic sections (only those with anomalies)
    sections = ""

    if has_seo:
        sections += """
---

### SEO

Give a short paragraph introducing the SEO state of the website.

For each of the 2 or 3 most critical SEO problems:

#### [Problem title in French]

Write one paragraph explaining what the problem is and why it matters for search engine ranking.

Write one paragraph explaining the exact steps to fix it. Provide complete explanations without referring to external documentation.

Show a concrete HTML code example of the correct implementation.

CRITICAL RULE: Write ONLY plain text explanations. Never write URLs, web addresses, or suggest external links. Provide all necessary information directly in the text.

"""

    if has_perf:
        sections += """
---

### Performance

Give a short paragraph introducing the performance state of the website.

For each of the 2 or 3 most critical performance problems:

#### [Problem title in French]

Write one paragraph explaining what the problem is and why it impacts user experience and loading speed.

Write one paragraph explaining the exact steps to fix it. Provide complete explanations without referring to external documentation.

CRITICAL RULE: Write ONLY plain text explanations. Never write URLs, web addresses, or suggest external links. Provide all necessary information directly in the text.

"""

    if has_sec:
        sections += """
---

### Securite

Give a short paragraph introducing the security state of the website.

For each of the 2 or 3 most critical security problems:

#### [Problem title in French]

Write one paragraph explaining what the problem is and why it represents a risk.

Write one paragraph explaining the exact steps to fix it. Provide complete explanations without referring to external documentation.

CRITICAL RULE: Write ONLY plain text explanations. Never write URLs, web addresses, or suggest external links. Provide all necessary information directly in the text.

"""

    prompt = f"""You are a senior web audit consultant writing an official audit report for a client.

Website audited: {data.url}
Global Score: {data.global_score}/100

Analyses performed: {", ".join(data.analyses)}

Detected issues:
{issues_text}

Write a complete professional audit report in French following EXACTLY this structure:

### Rapport d'Audit - [website name]

Give a short professional introduction paragraph summarizing the overall state of the website based on the global score and the analyses performed. IMPORTANT: 
- Write only the website name, not the URL
- Only mention the analyses that actually have issues: {", ".join(active_sections) if active_sections else "none"}
- Skip analyses that had zero issues
- Keep the introduction concise (2-3 sentences maximum)

{sections}

---

### Conclusion

Write a short professional conclusion paragraph summarizing the main actions to take and the expected improvement if applied. Only mention the analyses that were performed and had issues: {", ".join(active_sections)}.

STRICT FORMATTING RULES — THESE ARE MANDATORY:
1. Write entirely in French
2. Write in professional flowing paragraphs
3. Leave a blank line between each paragraph
4. ONLY write sections for these analyses (that have issues): {", ".join(active_sections)}
5. Skip any section that has no issues
6. Write complete explanations - provide all information directly in the text
7. Use ONLY plain text - absolutely no hyperlinks, no URLs, no web addresses
8. If you would normally write a link, write the explanation instead
9. Include HTML code examples only for SEO problems
10. Use NO bullet points or numbered lists outside of code blocks
11. Start directly with the report content, no preamble

CRITICAL - ABOUT EXTERNAL REFERENCES:
- Never write "En savoir plus"
- Never write "Pour plus d'informations"
- Never write URLs or web addresses in any format (http://, https://, www.)
- Never suggest consulting external documentation
- Provide complete, self-contained explanations
- All information must be included directly in your response
"""
    return prompt


@app.post("/recommendations")
async def generate_recommendations(data: AuditData):
    import time  # ✅ Add this import at the top of the function
    
    # Print client analysis request
    print_client_analysis(data)
    
    print(f"[AI] Received analyses: {data.analyses}")
    
    # Check if there are any anomalies at all
    total_anomalies = len(data.seo_anomalies) + len(data.perf_anomalies) + len(data.sec_anomalies)
    
    if total_anomalies == 0:
        print("[AI] No anomalies detected in any section - generating positive report")
    
    prompt = build_prompt(data)

    # ✅ Start timing
    start_time = time.time()

    full_text = ""
    async with httpx.AsyncClient(timeout=600) as client:
        for attempt in range(3):
            response = await client.post(OLLAMA_URL, json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": 8000,
                    "temperature": 0.3,
                    "num_ctx": 8192,
                    "stop": ["<|end_of_one_answer|>", "<|end_of_text|>", "<|im_end|>"]
                }
            })
            result = response.json()
            full_text = result.get("response", "").strip()
            if full_text:
                break
            print(f"[AI] Attempt {attempt+1} returned empty, retrying...")

    # ✅ Calculate time
    generation_time = time.time() - start_time

    print(f"[AI] Response length: {len(full_text)} chars")
    print(f"⏱️  Generation time: {generation_time:.2f}s")

    text = full_text.strip()
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    text = format_as_paragraph(text)
    
    # Remove any remaining URLs or links
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'En savoir plus\s*:\s*', '', text)
    text = re.sub(r'\((?:https?://\S+)\)', '', text)

    # Post-processing — force remove unwanted sections
    has_seo = ("seo_tech" in data.analyses or "seo" in data.analyses) and len(data.seo_anomalies) > 0
    has_perf = "performance" in data.analyses and len(data.perf_anomalies) > 0
    has_sec = "security" in data.analyses and len(data.sec_anomalies) > 0
    
    text = remove_unwanted_sections(text, has_seo, has_perf, has_sec)

    # ✅ Calculate metrics
    word_count = len(text.split())
    token_count = int(word_count / 0.75)  # Approximate token count

    print(f"[AI] Final length: {len(text)} chars")
    print(f"📊 Words: {word_count} | Tokens: ~{token_count}")
    
    # Log sections
    generated_sections = []
    if has_seo: generated_sections.append("SEO")
    if has_perf: generated_sections.append("Performance")
    if has_sec: generated_sections.append("Security")
    
    if generated_sections:
        print(f"[AI] Sections: {', '.join(generated_sections)}")
    else:
        print(f"[AI] No sections (no issues found)")

    # ✅ Log metrics to CSV (INSIDE the function)
    log_metrics(data.job_id, data.url, generation_time, word_count, token_count)

    return { 
        "job_id": data.job_id, 
        "recommendations": text,
        "metrics": {
            "generation_time_seconds": round(generation_time, 2),
            "word_count": word_count,
            "token_count": token_count,
            "tokens_per_second": int(token_count / generation_time) if generation_time > 0 else 0
        }
    }


def log_metrics(job_id, url, generation_time, word_count, token_count):
    """Log generation metrics to CSV for analysis"""
    with open("generation_metrics.csv", "a", newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Write header if file is empty
        if f.tell() == 0:
            writer.writerow([
                "timestamp", "job_id", "url", "model", 
                "generation_time_s", "word_count", "token_count", "tokens_per_sec"
            ])
        
        writer.writerow([
            datetime.now().isoformat(),
            job_id,
            url,
            MODEL,
            round(generation_time, 2),
            word_count,
            token_count,
            int(token_count / generation_time) if generation_time > 0 else 0
        ])


@app.get("/health")
def health():
    return {"status": "ok"}