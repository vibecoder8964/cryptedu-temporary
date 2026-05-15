"""
CryptEdu RAG Pipeline — PDF ingestion, chunking, embedding, and retrieval.
Uses ChromaDB for vector storage and sentence-transformers for embeddings.
"""
import os, logging, sys
from typing import List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CHROMA_DIR

logger = logging.getLogger(__name__)
COLLECTION_NAME = "cryptedu_knowledge"
_chroma_client = _collection = _embedder = None

def _get_chroma():
    global _chroma_client, _collection
    if _chroma_client is None:
        import chromadb
        os.makedirs(CHROMA_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = _chroma_client.get_or_create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
    return _collection

def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip(): chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

def ingest_document(doc_id: str, filename: str, text: str) -> int:
    collection = _get_chroma()
    embedder = _get_embedder()
    chunks = chunk_text(text)
    if not chunks: return 0
    embeddings = embedder.encode(chunks, show_progress_bar=False).tolist()
    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]
    collection.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    return len(chunks)

def remove_document(doc_id: str):
    collection = _get_chroma()
    results = collection.get(where={"doc_id": doc_id})
    if results["ids"]: collection.delete(ids=results["ids"])

def query_rag(question: str, top_k: int = 5) -> List[dict]:
    collection = _get_chroma()
    embedder = _get_embedder()
    if collection.count() == 0: return []
    qe = embedder.encode([question]).tolist()
    results = collection.query(query_embeddings=qe, n_results=min(top_k, collection.count()))
    return [{"text": results["documents"][0][i], "filename": results["metadatas"][0][i].get("filename","unknown"),
             "score": round(1 - results["distances"][0][i], 4) if results["distances"] else 0}
            for i in range(len(results["documents"][0]))]

def get_collection_stats() -> dict:
    try:
        return {"total_chunks": _get_chroma().count(), "status": "ready"}
    except Exception as e:
        return {"total_chunks": 0, "status": f"error: {e}"}
