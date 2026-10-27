import os
import argparse
import sys
from backend.services.retrieval_service import RetrievalService

def ingest_documents(mode: str):
    print(f"Starting ingestion for mode: {mode}")
    
    # Locate target folder
    base_dir = os.path.dirname(os.path.abspath(__file__))
    knowledge_dir = os.path.join(base_dir, "knowledge", mode)
    
    if not os.path.exists(knowledge_dir):
        print(f"Error: Knowledge directory {knowledge_dir} does not exist.")
        sys.exit(1)
        
    # Initialize service to get the correct collection
    retrieval_service = RetrievalService(mode=mode)
    collection = retrieval_service.collection
    
    documents = []
    metadatas = []
    ids = []
    
    # Iterate files
    for filename in os.listdir(knowledge_dir):
        if not filename.endswith(".txt"):
            continue
        filepath = os.path.join(knowledge_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    documents.append(content)
                    metadatas.append({"source": filename})
                    ids.append(filename)
        except Exception as e:
            print(f"Error reading file {filename}: {e}")
            
    if not documents:
        print(f"No documents found to ingest under {knowledge_dir}.")
        return
        
    print(f"Ingesting {len(documents)} documents into '{retrieval_service.collection_name}' Chroma collection...")
    
    # Upsert elements into collection (replaces/updates if already present)
    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    print("Ingestion completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest knowledge base documents into ChromaDB.")
    parser.add_argument(
        "--mode",
        choices=["public", "employee"],
        required=True,
        help="Chatbot mode (public or employee)"
    )
    args = parser.parse_args()
    
    ingest_documents(args.mode)
