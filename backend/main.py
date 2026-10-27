import os
import re
import hashlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ollama import chat
from backend.services.chat_service import ChatService

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_sessions = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str
    mode: str = "public"

STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'its', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'i',
    'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose',
    'when', 'where', 'why', 'how', 'this', 'that', 'these', 'those', 'am',
    'not', 'so', 'if', 'then', 'than', 'too', 'very', 'just', 'about',
    'above', 'after', 'again', 'all', 'also', 'any', 'because', 'before',
    'between', 'both', 'during', 'each', 'few', 'more', 'most', 'other', 'our',
    'out', 'own', 'same', 'some', 'such', 'no', 'nor', 'only', 'now',
}

_knowledge_index = []
_knowledge_dir_mtime = None
_query_cache = {}
_QUERY_CACHE_MAX = 256

def _extract_keywords(text: str) -> set:
    words = re.findall(r'\b\w+\b', text.lower())
    result = set()
    for w in words:
        if w in STOP_WORDS or len(w) <= 2:
            continue
        result.add(w)
        if w.endswith('ies'):
            result.add(w[:-3] + 'y')
        elif w.endswith('ses') or w.endswith('xes') or w.endswith('zes'):
            result.add(w[:-2])
        elif w.endswith('s') and not w.endswith('ss'):
            result.add(w[:-1])
    return result

def _get_knowledge_dir(mode: str) -> str:
    if mode == "employee":
        return os.path.join(os.path.dirname(__file__), "knowledge", "employee")
    return os.path.join(os.path.dirname(__file__), "knowledge", "public")

def _build_knowledge_index(mode: str = "public") -> None:
    global _knowledge_index, _knowledge_dir_mtime
    knowledge_dir = _get_knowledge_dir(mode)
    if not os.path.exists(knowledge_dir):
        _knowledge_index = []
        return

    try:
        dir_mtime = os.path.getmtime(knowledge_dir)
    except OSError:
        _knowledge_index = []
        return

    if _knowledge_dir_mtime == dir_mtime and _knowledge_index:
        return

def _extract_document_metadata(text: str, filename: str) -> dict:
    doc_no_m = re.search(r'Document No:\s*(.*)', text, re.IGNORECASE)
    rev_m = re.search(r'Revision No:\s*(.*)', text, re.IGNORECASE)
    eff_m = re.search(r'Effective Date:\s*(.*)', text, re.IGNORECASE)

    fn_lower = filename.lower()
    is_it_sec = any(k in fn_lower for k in [
        'it_security', 'access_control', 'cryptography', 'data_protection',
        'endpoint_software', 'incident_response', 'information_asset', 'mobile_hr'
    ])

    if is_it_sec:
        title = "IT Security Policy v1.0"
        written_by = "Khairul Akhmal Shahabuddin"
        written_title = "Manager, Innovation & Technology"
        reviewed_by = "Mohd Azhar Ahmad"
        reviewed_title = "HOD, Innovation & Technology"
        approved_by = "Shahrul Ekram Sofian @ Mokhtar"
        approved_title = "CFO"
    elif 'annual_leave' in fn_lower:
        title = "Annual Leave Policy"
        written_by = "Human Capital Dept"
        written_title = "Manager, HR"
        reviewed_by = "Head of Division"
        reviewed_title = "HOD, Human Capital"
        approved_by = "Executive Management"
        approved_title = "CFO"
    elif 'employment' in fn_lower:
        title = "Employment Policy"
        written_by = "Human Capital Dept"
        written_title = "Manager, HR"
        reviewed_by = "Head of Division"
        reviewed_title = "HOD, Human Capital"
        approved_by = "Executive Management"
        approved_title = "CFO"
    elif 'leave_application' in fn_lower:
        title = "Leave Application Process"
        written_by = "Human Capital Dept"
        written_title = "Manager, HR"
        reviewed_by = "Head of Division"
        reviewed_title = "HOD, Human Capital"
        approved_by = "Executive Management"
        approved_title = "CFO"
    elif 'intern_leave' in fn_lower:
        title = "Intern Leave Policy"
        written_by = "Human Capital Dept"
        written_title = "Manager, HR"
        reviewed_by = "Head of Division"
        reviewed_title = "HOD, Human Capital"
        approved_by = "Executive Management"
        approved_title = "CFO"
    else:
        title_m = re.search(r'Policy Title:\s*(.*)', text, re.IGNORECASE)
        if title_m:
            title = title_m.group(1).strip()
        else:
            base_title = filename.replace(".txt", "").replace("_", " ").title()
            title = base_title.replace("It ", "IT ")
        written_by = "TPB Policy Team"
        written_title = "Manager, Policy"
        reviewed_by = "Head of Department"
        reviewed_title = "HOD"
        approved_by = "Executive Management"
        approved_title = "CFO"

    doc_no = doc_no_m.group(1).strip() if doc_no_m else "IT-SEC-01"
    revision = rev_m.group(1).strip() if rev_m else "01"
    effective = eff_m.group(1).strip() if eff_m else "1 Jan 2024"

    return {
        "title": title,
        "doc_no": doc_no,
        "revision": revision,
        "effective": effective,
        "written_by": written_by,
        "written_title": written_title,
        "reviewed_by": reviewed_by,
        "reviewed_title": reviewed_title,
        "approved_by": approved_by,
        "approved_title": approved_title
    }

def _build_knowledge_index(mode: str = "public") -> None:
    global _knowledge_index, _knowledge_dir_mtime
    knowledge_dir = _get_knowledge_dir(mode)
    if not os.path.exists(knowledge_dir):
        _knowledge_index = []
        return

    try:
        dir_mtime = os.path.getmtime(knowledge_dir)
    except OSError:
        _knowledge_index = []
        return

    if _knowledge_dir_mtime == dir_mtime and _knowledge_index:
        return

    _knowledge_index = []
    for filename in os.listdir(knowledge_dir):
        if not filename.endswith(".txt"):
            continue
        filepath = os.path.join(knowledge_dir, filename)
        try:
            mtime = os.path.getmtime(filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                text = f.read()
        except Exception:
            continue

        text_lower = text.lower()
        text_words = set(re.findall(r'\b\w+\b', text_lower))
        kw_section = ""
        m = re.search(r'Keywords?:\s*(.*?)(?:\Z|\n\n)', text, re.IGNORECASE | re.DOTALL)
        if m:
            kw_section = m.group(1)

        metadata = _extract_document_metadata(text, filename)

        # Break text into paragraphs for fast snippet retrieval
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]

        _knowledge_index.append({
            "filename": filename,
            "text": text,
            "text_lower": text_lower,
            "text_words": text_words,
            "base_name": filename.replace(".txt", "").replace("_", " "),
            "file_mtime": mtime,
            "keywords": _extract_keywords(kw_section) if kw_section else set(),
            "metadata": metadata,
            "paragraphs": paragraphs
        })

    _knowledge_dir_mtime = dir_mtime

def load_relevant_knowledge(query: str, mode: str = "public") -> tuple:
    if not query or not query.strip():
        return "", None

    cache_key = hashlib.md5(f"{mode}:{query.lower().strip()}".encode()).hexdigest()
    if cache_key in _query_cache:
        return _query_cache[cache_key]

    _build_knowledge_index(mode)
    keywords = _extract_keywords(query)
    if not keywords:
        return "", None

    scored = []
    for entry in _knowledge_index:
        score = sum(1 for kw in keywords if kw in entry["text_words"])
        score += sum(10 for kw in keywords if kw in entry["keywords"])
        score += sum(10 for kw in keywords if kw in entry["base_name"].split())
        if score > 0:
            # Score individual paragraphs to keep prompt concise & fast
            best_paragraphs = []
            for p in entry["paragraphs"]:
                p_lower = p.lower()
                p_score = sum(1 for kw in keywords if kw in p_lower)
                if p_score > 0 and not p_lower.startswith("keywords:"):
                    best_paragraphs.append((p_score, p))
            best_paragraphs.sort(key=lambda x: x[0], reverse=True)
            top_p_text = "\n\n".join([p for _, p in best_paragraphs[:3]]) if best_paragraphs else entry["text"][:1500]
            scored.append((score, top_p_text, entry["filename"], entry["metadata"]))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:2]

    if 'intern' in keywords:
        top = [(s, t, f, m) for s, t, f, m in top if 'intern' in f]

    if not top:
        result_text = ""
        primary_metadata = None
    else:
        cleaned = []
        for _, txt, fn, _ in top:
            cleaned_txt = re.sub(r'(?im)^Keywords?:.*$', '', txt)
            cleaned_txt = re.sub(r'\n{3,}', '\n\n', cleaned_txt).strip()
            cleaned.append(cleaned_txt)
        result_text = "\n\n".join(cleaned)
        # Cap total context words (~400 words) for ultra-fast Ollama response
        words = result_text.split()
        if len(words) > 450:
            result_text = " ".join(words[:450]) + "..."
        primary_metadata = top[0][3]

    res = (result_text, primary_metadata)
    _query_cache[cache_key] = res
    if len(_query_cache) > _QUERY_CACHE_MAX:
        _query_cache.pop(next(iter(_query_cache)))

    return res

@app.get("/")
def home():
    return {"message": "Tradewinds AI Backend Running"}

@app.post("/chat")
def chatbot(request: ChatRequest):
    if request.session_id not in chat_sessions:
        chat_sessions[request.session_id] = []

    history = chat_sessions[request.session_id]
    company_context, source_info = load_relevant_knowledge(request.message, request.mode)

    if request.mode == "employee":
        mode_instruction = (
            "You are Tradewinds AI Employee Support Assistant. "
            "Provide helpful information about internal policies, leave applications, payroll, IT support, onboarding, and other employee-related topics based on the company documents provided."
        )
        unavailable_rule = (
            "If information is unavailable in the company documents, say:\n"
            "   'I do not have enough information to answer that question. Please contact Tradewinds directly for assistance.'"
        )
    else:
        mode_instruction = (
            "You are Tradewinds AI Assistant serving in Public Mode.\n"
            "IMPORTANT: You MUST strictly limit your answers to public company information (such as general company profile, history, contact info, sustainability, and career opportunities).\n"
            "You DO NOT have access to internal employee documents, staff leave policies, IT security compliance policies, internal HR rules, or payroll data."
        )
        unavailable_rule = (
            "If the user asks about employee leave policies, IT security policies, internal staff procedures, or any internal employee data while in Public mode, OR if information is unavailable in public documents, say:\n"
            "   'I do not have enough information to answer that question as this content is restricted to authorized employees. If you are a staff member, please switch to Employee mode and verify your Staff ID.'"
        )

    system_prompt = {
        "role": "system",
        "content": f"""
{mode_instruction}

Rules:
 - Answer professionally and politely.
 - Use clear business language.
 - Break long paragraphs into multiple small sentences.
 - Use numbered lists appropriately.
 - Be concise and use short paragraphs not more than 3 sentences.
 - Put each numbered item on a separate line.
 - Do not use "*" in answers.
 - Separate line or leave a blank line between title or heading and body text.
 - Do not use markdown formatting symbols (*, #, ~) in text answers, BUT you MAY use standard Markdown table format (| Header 1 | Header 2 |) when presenting schedules, retention rules, or tabular data.
 - Do not use bullet points unless the user specifically requests them.
 - Keep answers concise and easy to understand.
 - Be precise and do not give wrong information.
 - Summarize information naturally and avoid lengthy explanations.
 - Always use numeric digits (e.g. 7 days, 1 month, 12 months, 7 years) when stating quantities, durations, retention periods, or dates instead of spelling numbers out as words (e.g. do NOT write 'twelve months' or 'seven years').
 - Do not mention any document or file names in your answers.
 - {unavailable_rule}

Company Information:
{company_context}
"""
    }

    messages = [system_prompt] + history + [
        {"role": "user", "content": request.message}
    ]

    response = chat(
        model="gemma3:4b",
        messages=messages,
        options={"num_predict": 200, "temperature": 0.1}
    )

    answer = response.message.content

    history.append({"role": "user", "content": request.message})
    history.append({"role": "assistant", "content": answer})

    res = {"answer": answer}
    if source_info and request.mode == "employee":
        res["source"] = source_info

    return res
