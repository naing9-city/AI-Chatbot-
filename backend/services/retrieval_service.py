import os
import re

class RetrievalService:
    def __init__(self, mode: str):
        self.mode = mode
        if mode == "employee":
            self.knowledge_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge", "employee")
        else:
            self.knowledge_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge", "public")

    def load_relevant_knowledge(self, query: str) -> str:
        if not query or not query.strip():
            return ""

        knowledge_dir = self.knowledge_dir
        if not os.path.exists(knowledge_dir):
            return ""

        query_words = set(re.findall(r'\w+', query.lower()))
        if not query_words:
            return ""

        scores = {}
        contents = {}

        for filename in os.listdir(knowledge_dir):
            if filename.endswith(".txt"):
                filepath = os.path.join(knowledge_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        text = f.read()
                    contents[filename] = text
                    text_words = re.findall(r'\w+', text.lower())
                    score = sum(1 for word in query_words if word in text_words)
                    scores[filename] = score
                except Exception:
                    continue

        sorted_files = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        relevant_texts = []
        for filename, score in sorted_files[:3]:
            if score > 0:
                relevant_texts.append(contents[filename])

        return "\n\n".join(relevant_texts)
