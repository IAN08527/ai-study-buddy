# context.md: AI Study Buddy (MVP)

## 1. Project Identity & Vision
**AI Study Buddy** is a syllabus-aware, personalized learning platform designed to eliminate academic friction. Unlike generic LLMs, it uses **Retrieval-Augmented Generation (RAG)** to provide answers strictly grounded in the user's own uploaded notes and syllabus, paired with a distraction-free YouTube learning environment.

* **Status:** MVP Development (16-week timeline)
* **Target:** Students seeking focused, context-specific study assistance.

---

## 2. Core Technology Stack
| Layer | Technology | Implementation Detail |
| :--- | :--- | :--- |
| **Frontend/Backend** | **Next.js (App Router)** | Full-stack architecture for UI and API routes. |
| **Database** | **Supabase (PostgreSQL)** | Stores structured data (Users, Subjects, Chapters). |
| **Vector Store** | **Supabase Vector (pgvector)** | Stores document embeddings for RAG. |
| **File Storage** | **Supabase Storage** | Hosts raw PDF/Text notes and syllabi. |
| **AI Model** | **Deepseek R1 8b** | Local LLM for privacy and cost-efficiency. |
| **LLM Orchestration**| **Ollama** | Manages local model communication. |
| **Deployment** | **Vercel** | Hosting for the Next.js application. |

---

## 3. System Architecture & Flow
The system follows a standard RAG (Retrieval-Augmented Generation) pipeline:

1.  **Ingestion:** User uploads PDF/Text -> Text is extracted -> Chunked -> Processed by an Embedding Model -> Stored in **Supabase Vector**.
2.  **Retrieval:** User asks a question -> Query is embedded -> **Vector Search** finds relevant chunks in the database.
3.  **Generation:** Contextual chunks + User query -> **Deepseek R1 8b** (via Ollama) -> Response streamed to Next.js UI.
4.  **Video Integration:** `react-player` renders YouTube links in a container that strips away "Up Next" distractions and comments.



---

## 4. Database Schema (Summary)
The database architecture defines four primary entities:
* **Users:** Authentication via Google (Supabase Auth).
* **Subjects:** Linked to Users (e.g., "Data Structures").
* **Chapters:** Linked to Subjects; contains syllabus details.
* **Notes/Embeddings:** Linked to Chapters; stores the vector data for AI retrieval.



---

## 5. MVP Functional Requirements
* **Auth:** Google Sign-On via Supabase.
* **Organization:** Manual creation of Subjects and Chapters.
* **RAG Chat:** Syllabus-aware chatbot with per-subject history.
* **Video Zone:** Manual YouTube link input with distraction-free playback.
* **Note Management:** Support for Text and PDF (Non-OCR) uploads.

---

## 6. Project Roadmap (WBS Highlights)
The project is structured into **16 weeks**:
* **Phase 1 (Weeks 1-4):** Environment setup, LLM integration (Ollama), and Supabase Vector configuration.
* **Phase 2 (Weeks 5-10):** Core UI development, Note upload logic, and RAG pipeline refinement.
* **Phase 3 (Weeks 11-14):** Video player integration and Subject/Chapter management.
* **Phase 4 (Weeks 15-16):** Testing, Bug fixes, and Vercel deployment.

---

## 7. Key Risks & Constraints
* **Hardware Limitation:** Running Deepseek R1 8b locally requires significant RAM/GPU resources.
* **Latency:** RAG response times must be managed via streaming to ensure a smooth UI/UX.
* **Scope Creep:** Future features like Gamification and OCR are strictly **Non-MVP** and deferred to post-submission.