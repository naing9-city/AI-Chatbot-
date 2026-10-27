from typing import List, Dict, Any, Optional

class ChatService:
    @classmethod
    def get_session_history(cls, session_id: str) -> List[Dict[str, str]]:
        from backend.main import chat_sessions
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []
        return chat_sessions[session_id]

    @classmethod
    def clear_session_history(cls, session_id: str) -> None:
        from backend.main import chat_sessions
        if session_id in chat_sessions:
            chat_sessions[session_id] = []

    @classmethod
    def process_chat(cls, message: str, session_id: str, mode: str = "public") -> str:
        # 1. Initialize retrieval service for the specific mode
        retrieval_service = RetrievalService(mode=mode)

        # 2. Query knowledge base context
        company_context = retrieval_service.load_relevant_knowledge(message)

        # 3. Fetch history
        history = cls.get_session_history(session_id)

        # 4. Formulate the RAG system prompt
        if mode == "employee":
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

        # 5. Build messages array
        messages = [system_prompt] + history + [
            {"role": "user", "content": message}
        ]

        # 6. Query local Gemma model
        from ollama import chat
        response = chat(
            model="gemma3:4b",
            messages=messages,
            options={"num_predict": 200, "temperature": 0.1}
        )

        answer = response.message.content

        # 7. Update memory history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": answer})

        return answer
