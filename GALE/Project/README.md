# P28 – Hybrid BM25 and Dense Retrieval for Technical Support Search

<p align="center">
  <strong>Generative AI & AI Platform Engineering (GALE)</strong><br>
  Information Retrieval | Semantic Search | Hybrid Retrieval
</p>

---

## 📌 Project Overview

P28 explores a hybrid information retrieval approach for technical support search by combining **BM25-based keyword retrieval** with **dense semantic retrieval**.

Traditional keyword-based retrieval identifies relevant documents through term matching, while dense retrieval captures semantic relationships using text embeddings. Combining these approaches aims to improve search relevance by considering both keyword matches and contextual meaning.

The project focuses on understanding, implementing, and evaluating hybrid retrieval techniques for technical support information.

## 🎯 Project Objectives

- Implement traditional keyword-based retrieval using BM25.
- Explore dense retrieval using text embeddings.
- Generate semantic embeddings using Sentence Transformers.
- Understand vector similarity search using FAISS or ChromaDB.
- Combine keyword and dense retrieval techniques.
- Evaluate retrieval effectiveness using standard information retrieval metrics.

## ⚙️ System Components

| Component | Description |
|:--|:--|
| **BM25 Retrieval** | Ranks documents based on keyword relevance. |
| **Dense Retrieval** | Retrieves semantically similar documents using embeddings. |
| **Sentence Transformers** | Generates dense vector representations of text. |
| **Vector Search** | Enables similarity-based retrieval using FAISS or ChromaDB. |
| **Hybrid Retrieval** | Combines keyword-based and semantic retrieval results. |
| **Performance Evaluation** | Measures retrieval quality using standard evaluation metrics. |

## 🛠️ Technology Stack

| Technology | Purpose |
|:--|:--|
| Python | Core implementation |
| BM25 | Keyword-based information retrieval |
| Sentence Transformers | Text embedding generation |
| FAISS / ChromaDB | Vector similarity search |
| Text Embeddings | Semantic document representation |
| Precision@K, Recall@K, MRR | Retrieval evaluation |

## 🔄 Proposed Workflow

1. Prepare technical support documents and search queries.
2. Implement BM25-based keyword retrieval.
3. Generate document and query embeddings using Sentence Transformers.
4. Perform dense retrieval using vector similarity search.
5. Combine keyword and dense retrieval results.
6. Evaluate retrieval effectiveness using standard metrics.

## 📊 Evaluation Metrics

- **Precision@K:** Measures the proportion of relevant documents among the top K retrieved results.
- **Recall@K:** Measures the proportion of all relevant documents retrieved within the top K results.
- **Mean Reciprocal Rank (MRR):** Measures the ranking position of the first relevant result.

## 📚 Expected Learning Outcomes

- Understand the fundamentals of information retrieval.
- Gain practical exposure to BM25 and dense retrieval.
- Work with semantic embeddings and vector search.
- Understand hybrid retrieval architectures.
- Evaluate search performance using information retrieval metrics.

## 📁 Project Resources

This directory maintains the project's implementation, source code, supporting resources, technical documentation, and execution results.

---

## 👥 Project Information

| Detail | Description |
|:--|:--|
| Project ID | P28 |
| Project Title | Hybrid BM25 and Dense Retrieval for Technical Support Search |
| Team | Team 2 |
| Course | Generative AI & AI Platform Engineering |
| Academic Level | B.Tech – Trimester 5 |

---

*Developed as part of the Generative AI & AI Platform Engineering coursework.*
