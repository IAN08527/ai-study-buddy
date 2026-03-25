# AI Study Buddy — Complete Project Documentation

> **A syllabus-aware, personalized learning platform** that uses Retrieval-Augmented Generation (RAG) to provide answers grounded in the student's own uploaded notes and syllabus, paired with a distraction-free YouTube learning environment.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project File Structure](#3-project-file-structure)
4. [Environment Variables](#4-environment-variables)
5. [System Architecture & Flow](#5-system-architecture--flow)
6. [Database Schema](#6-database-schema)
7. [Authentication Flow](#7-authentication-flow)
8. [Routing & Page Structure](#8-routing--page-structure)
9. [Middleware (proxy.js)](#9-middleware-proxyjs)
10. [API Routes — Full Reference](#10-api-routes--full-reference)
11. [RAG Pipeline — Deep Dive](#11-rag-pipeline--deep-dive)
12. [Library / Utility Modules](#12-library--utility-modules)
13. [React Components — Full Reference](#13-react-components--full-reference)
14. [Styling & Design System](#14-styling--design-system)
15. [Scripts & Tooling](#15-scripts--tooling)
16. [Key Features Summary](#16-key-features-summary)
17. [FAQ / Common Questions](#17-faq--common-questions)

---

## 1. Project Overview

**AI Study Buddy** is a college Major Project built as a web application that helps students study more effectively by combining:
- An **AI chatbot** powered by RAG that answers questions using the student's _own uploaded notes_ and syllabus PDFs.
- A **distraction-free YouTube video player** for focused study sessions.
- A **file management system** for organizing subjects, chapters, notes (PDFs), and videos.

### Core Concept
Unlike generic AI chatbots (ChatGPT, Gemini, etc.), AI Study Buddy is **syllabus-aware** — it only answers from the student's own uploaded materials. When the context isn't sufficient, it clearly states that it is supplementing with general knowledge.

### Target Users
College students who want a **focused, context-specific** study assistant.

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2.1 | UI library for building the interface |
| **Next.js** | 16.0.8 | Full-stack React framework (App Router) |
| **TailwindCSS** | 4.1.18 | Utility-first CSS framework |
| **@tailwindcss/typography** | 0.5.19 | Prose styling for rendered markdown |
| **react-markdown** | 10.1.0 | Renders AI responses as formatted Markdown |
| **remark-gfm** | 4.0.1 | GitHub Flavored Markdown support (tables, strikethrough, etc.) |
| **remark-breaks** | 4.0.0 | Converts newlines to `<br>` in markdown |
| **react-syntax-highlighter** | 16.1.0 | Code syntax highlighting in AI responses |
| **react-toastify** | 11.0.5 | Toast notification popups |

### Backend (Next.js API Routes)
| Technology | Version | Purpose |
|---|---|---|
| **Next.js API Routes** | 16.0.8 | Server-side API endpoints |
| **Groq SDK** | 0.37.0 | LLM inference API client for chat completions |
| **pdf-parse** | 1.1.1 | Extracts text content from PDF files |
| **docx** | 9.6.0 | DOCX document support (installed but not actively used in MVP) |

### AI / ML Services
| Service | Model / Details | Purpose |
|---|---|---|
| **Groq Cloud** | `llama-3.3-70b-versatile` | Main LLM for generating chat responses |
| **Hugging Face Inference API** | `BAAI/bge-base-en-v1.5` (768-dim) | Embedding model for vectorizing text chunks |
| **Google Gemini** | API Key configured | Alternative AI model (configured but Groq is actively used) |

### Database & Storage
| Service | Purpose |
|---|---|
| **Supabase (PostgreSQL)** | Relational database for Users, Subjects, Chapters, Resources, Chat History, Conversations |
| **Supabase pgvector** | Vector store for document embeddings (768-dim vectors) |
| **Supabase Storage** | File storage for uploaded PDFs (two buckets: `syllabus` and `user_notes`) |
| **Supabase Auth** | User authentication (Email/Password + Google OAuth) |
| **@supabase/supabase-js** | Supabase JavaScript client |
| **@supabase/ssr** | Supabase Server-Side Rendering helpers for Next.js |

### Deployment
| Service | Purpose |
|---|---|
| **Vercel** | Hosting platform for the Next.js application |
| **pnpm** | Package manager used for dependency management |

---

## 3. Project File Structure

```
ai-study-buddy/
├── .env.local                    # Environment variables (API keys, Supabase config)
├── .gitignore                    # Git ignore rules
├── package.json                  # Project dependencies & scripts
├── pnpm-lock.yaml                # pnpm lockfile
├── next.config.mjs               # Next.js configuration
├── postcss.config.mjs            # PostCSS configuration (for TailwindCSS)
├── eslint.config.mjs             # ESLint configuration
├── jsconfig.json                 # JavaScript path aliases (@/ → root)
├── proxy.js                      # Next.js middleware (auth guards & redirects)
├── context.md                    # Project context document (overview)
│
├── app/                          # === NEXT.JS APP ROUTER ===
│   ├── layout.js                 # Root layout (fonts, metadata, ToastProvider)
│   ├── page.js                   # Home page → SignInPage component
│   ├── globals.css               # Global styles + TailwindCSS theme
│   ├── subject.css               # Subject page styles (~51KB, extensive)
│   ├── error.jsx                 # Global error boundary page
│   ├── not-found.jsx             # 404 page
│   ├── favicon.ico               # App favicon
│   │
│   ├── auth/
│   │   └── confirm/
│   │       └── page.jsx          # Email confirmation success page
│   │
│   ├── dashboard/
│   │   ├── page.js               # Dashboard (session-based, fetches user ID server-side)
│   │   └── [id]/
│   │       └── page.js           # Dashboard with explicit user ID parameter
│   │
│   ├── subject/
│   │   └── [id]/
│   │       └── page.js           # Subject detail page (AI Chat, Notes, Videos)
│   │
│   ├── welcomeMessage/
│   │   └── page.js               # Post-login welcome page with user's name
│   │
│   └── api/                      # === API ROUTES (13 endpoints) ===
│       ├── addSubject/
│       │   └── route.js          # POST: Create subject with chapters, PDFs, videos
│       ├── updateSubject/
│       │   └── route.js          # PUT: Update existing subject
│       ├── getSubjects/
│       │   └── [id]/route.js     # GET: List all subjects for a user
│       ├── getSubjectDetails/
│       │   └── [id]/route.js     # GET: Full subject data (chapters, resources)
│       ├── deleteSubject/
│       │   └── [id]/route.js     # DELETE: Remove subject + files from storage
│       ├── addVideo/
│       │   └── route.js          # POST: Add YouTube link/playlist to a subject
│       ├── deleteVideo/
│       │   └── [id]/route.js     # DELETE: Remove a YouTube video resource
│       ├── getPdfUrl/
│       │   └── [id]/route.js     # GET: Generate signed URL for PDF viewing
│       ├── getPlaylistVideos/
│       │   └── [playlistId]/route.js  # GET: Fetch playlist videos via YouTube RSS
│       ├── chat/
│       │   └── route.js          # POST: RAG chat endpoint (streaming)
│       ├── chatHistory/
│       │   └── [conversationId]/route.js  # GET/DELETE: Chat message history
│       ├── conversations/
│       │   └── [subjectId]/route.js      # GET/POST: List/Create conversations
│       └── conversation/
│           └── [conversationId]/route.js  # PUT/DELETE: Rename/Delete conversation
│
├── components/                   # === REACT COMPONENTS ===
│   ├── SignInPage.jsx            # Login/Signup form with email+password auth
│   ├── Dashboard.jsx             # Subject cards grid with CRUD actions
│   ├── SubjectForm.jsx           # Multi-step form for creating/editing subjects
│   ├── ConfirmSubject.jsx        # Confirmation dialog before subject submission
│   ├── DeleteSubject.jsx         # Delete confirmation dialog
│   ├── DocInput.jsx              # File upload input for PDFs
│   ├── YtInput.jsx               # YouTube link input component
│   ├── NavBar.jsx                # Top navigation bar
│   ├── SideBar.jsx               # Side navigation (dashboard layout)
│   ├── RedirectButton.jsx        # Button to redirect to dashboard
│   ├── WelcomePage.jsx           # Welcome message display
│   ├── ToastProvider.jsx         # react-toastify provider wrapper
│   │
│   └── subject/                  # Subject-specific components
│       ├── SubjectPage.jsx       # Main subject page controller (tab management)
│       ├── SubjectSidebar.jsx    # Left sidebar (tabs, chapter tree, resource list)
│       ├── AIChatTab.jsx         # AI Chat interface (RAG chatbot UI)
│       ├── NotesTab.jsx          # PDF viewer with zoom/download controls
│       ├── StudyVideosTab.jsx    # YouTube video player + playlist support
│       └── VideoNotes.jsx        # Timestamped notes for videos (localStorage)
│
├── lib/                          # === UTILITY LIBRARIES ===
│   ├── embeddings.js             # HuggingFace embedding generation (768-dim)
│   ├── pdfProcessor.js           # PDF extraction → chunking → embedding → storage
│   └── supabase/
│       ├── client.js             # Browser-side Supabase client
│       ├── server.js             # Server-side Supabase client (cookies)
│       └── proxy.js              # Middleware Supabase client (session management)
│
├── scripts/
│   └── revectorize.js            # CLI script to re-process all PDFs through RAG pipeline
│
├── public/                       # === STATIC ASSETS ===
│   ├── add.svg                   # Add button icon
│   ├── chapter.svg               # Chapter icon
│   ├── delete.svg                # Delete icon
│   ├── document.svg              # Document icon
│   ├── edit.svg                  # Edit icon
│   ├── googleLogo.svg            # Google sign-in logo
│   ├── left-arrow.png            # Left arrow
│   ├── right-arrow.png           # Right arrow
│   ├── subIcon.svg               # Subject icon
│   └── videos.svg                # Videos icon
│
└── supabase/                     # === SUPABASE LOCAL CONFIG ===
    ├── config.toml               # Supabase local development config
    ├── docker/                   # Docker setup for local Supabase
    └── system-migrations/        # Database migration files
```

---

## 4. Environment Variables

The `.env.local` file contains all sensitive configuration:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public, used client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public, used client-side) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, bypasses RLS) |
| `GEMINI_API_KEY` | Google Gemini API key (configured as alternative AI) |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_LOCATION` | Google Cloud region (us-central1) |
| `GROQ_API_KEY` | Groq Cloud API key (used for LLM chat completions) |
| `HF_ACCESS_TOKEN` | Hugging Face API token (used for text embeddings) |

> **Note:** `NEXT_PUBLIC_` prefixed variables are exposed to the browser. All others are server-side only.

---

## 5. System Architecture & Flow

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│  React 19 + Next.js 16 App Router + TailwindCSS v4           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ SignIn   │  │Dashboard │  │ Subject  │  │  Welcome     │ │
│  │ Page     │  │ Page     │  │ Page     │  │  Page        │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│                       │  │  │                                 │
└───────────────────────┼──┼──┼─────────────────────────────────┘
                        │  │  │        (HTTP / Streaming)
┌───────────────────────┼──┼──┼─────────────────────────────────┐
│                  NEXT.JS API ROUTES                            │
│  ┌──────────────┐ ┌───────────┐ ┌──────────────────────────┐  │
│  │ Subject CRUD │ │ Video CRUD│ │ Chat (RAG Pipeline)      │  │
│  │ APIs         │ │ APIs      │ │  1. Auth check           │  │
│  └──────┬───────┘ └─────┬─────┘ │  2. Load chat history    │  │
│         │               │       │  3. Embed query (HF)     │  │
│         │               │       │  4. Vector search (pg)   │  │
│         │               │       │  5. Build context        │  │
│         │               │       │  6. Stream LLM (Groq)    │  │
│         │               │       │  7. Save to DB           │  │
│         │               │       └──────────┬───────────────┘  │
└─────────┼───────────────┼──────────────────┼──────────────────┘
          │               │                  │
┌─────────┴───────────────┴──────────────────┴──────────────────┐
│                      SUPABASE                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ PostgreSQL │  │  pgvector  │  │  Storage   │               │
│  │ (Tables)   │  │ (Vectors)  │  │ (PDFs)     │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│  ┌────────────┐                                                │
│  │    Auth     │  (Email/Password, Google OAuth)               │
│  └────────────┘                                                │
└────────────────────────────────────────────────────────────────┘
          │                                    │
┌─────────┴────────┐              ┌────────────┴────────┐
│  Hugging Face    │              │     Groq Cloud      │
│  Inference API   │              │  (llama-3.3-70b)    │
│  (Embeddings)    │              │  (Chat Completions) │
└──────────────────┘              └─────────────────────┘
```

### RAG Pipeline Flow (Step-by-Step)

**Document Ingestion (when adding a subject):**
1. User uploads a PDF via the `SubjectForm` component
2. PDF binary is sent to `/api/addSubject` as `FormData`
3. API uploads the PDF to Supabase Storage (`syllabus` or `user_notes` bucket)
4. `pdfProcessor.js` extracts text using `pdf-parse`
5. Text is split into overlapping chunks (500 chars, 50 char overlap)
6. Each chunk is embedded using HuggingFace API → 768-dimensional vector
7. Vectors + text are stored in the `Vector_chunk` table (with pgvector)

**Query / Chat (when asking a question):**
1. User types a question in the `AIChatTab` component
2. Frontend sends POST to `/api/chat` with `{ query, subjectId, conversationId }`
3. API generates a 768-dim embedding for the query using HuggingFace
4. Supabase RPC `match_chunks` performs a cosine similarity search across stored vectors
5. Top 10 most relevant text chunks are retrieved
6. A system prompt + document context + conversation history + user query are assembled
7. Groq API streams the response using `llama-3.3-70b-versatile` model
8. Response tokens are streamed back to the frontend in real-time
9. Both user query and AI response are saved to `Chat_history` table

---

## 6. Database Schema

### Tables

#### `Subject`
| Column | Type | Description |
|---|---|---|
| `subject_id` | UUID (PK) | Auto-generated unique ID |
| `user_id` | UUID (FK → auth.users) | Owner of the subject |
| `name` | TEXT | Subject name (e.g., "Data Structures") |
| `created_at` | TIMESTAMP | Creation timestamp |

#### `Chapter`
| Column | Type | Description |
|---|---|---|
| `chapter_id` | UUID (PK) | Auto-generated unique ID |
| `subject_id` | UUID (FK → Subject) | Parent subject |
| `user_id` | UUID (FK → auth.users) | Owner |
| `Chapter_name` | TEXT | Chapter name |
| `order_index` | INTEGER | Display order (1, 2, 3…) |

#### `Resources`
| Column | Type | Description |
|---|---|---|
| `resource_id` | UUID (PK) | Auto-generated unique ID |
| `subject_id` | UUID (FK → Subject) | Parent subject |
| `chapter_id` | UUID (FK → Chapter), nullable | Parent chapter (NULL = global/syllabus) |
| `resource_type` | TEXT | One of: `"Syllabus PDF"`, `"Notes PDF"`, `"YouTube Link"`, `"YouTube Playlist"` |
| `title` | TEXT | Display name |
| `link` | TEXT | Storage path (for PDFs) or URL (for YouTube) |
| `document_summary` | TEXT | Auto-generated summary of the document content |

#### `Vector_chunk`
| Column | Type | Description |
|---|---|---|
| `chunk_id` | UUID (PK) | Auto-generated unique ID |
| `resource_id` | UUID (FK → Resources) | Parent resource |
| `text` | TEXT | Original text chunk |
| `content_embeddings` | vector(768) | 768-dim embedding vector |
| `chunk_index` | INTEGER | Position in document |
| `context_summary` | TEXT | Brief contextual description of the chunk |

#### `Conversations`
| Column | Type | Description |
|---|---|---|
| `conversation_id` | UUID (PK) | Auto-generated unique ID |
| `subject_id` | UUID (FK → Subject) | Associated subject |
| `user_id` | UUID (FK → auth.users) | Owner |
| `title` | TEXT | Conversation title (editable) |
| `created_at` | TIMESTAMP | Creation timestamp |

#### `Chat_history`
| Column | Type | Description |
|---|---|---|
| `chat_id` | UUID (PK) | Auto-generated unique ID |
| `conversation_id` | UUID (FK → Conversations) | Parent conversation |
| `user_id` | UUID (FK → auth.users) | Owner |
| `subject_id` | UUID (FK → Subject) | Associated subject |
| `message_role` | TEXT | `"user"` or `"assistant"` |
| `message_text` | TEXT | Message content |
| `created_at` | TIMESTAMP | Message timestamp |

### Supabase Storage Buckets
| Bucket | Purpose |
|---|---|
| `syllabus` | Stores syllabus PDF files (global to a subject, no chapter) |
| `user_notes` | Stores notes PDF files (linked to specific chapters) |

### Database Functions (RPC)
| Function | Purpose |
|---|---|
| `match_chunks` | Cosine similarity search across `Vector_chunk` table. Takes a query embedding, subject_id, optional resource_ids, and match_count. Returns matching chunks with similarity scores and document titles. |

---

## 7. Authentication Flow

### Supported Methods
1. **Email + Password** (Sign Up with name, email, password)
2. **Email confirmation** required after signup (redirect to `/auth/confirm`)

### Flow
1. User visits `/` → sees `SignInPage` component (login/signup toggle)
2. On signup: Supabase `auth.signUp()` is called → confirmation email sent
3. On login: Supabase `auth.signInWithPassword()` → session cookie set
4. Middleware (`proxy.js`) checks session on every request:
   - Logged in + visiting `/` → redirect to `/welcomeMessage`
   - Not logged in + visiting `/dashboard` or `/welcomeMessage` → redirect to `/`
5. Session is managed via cookies (Supabase SSR pattern)

---

## 8. Routing & Page Structure

| Route | Auth Required | Component | Description |
|---|---|---|---|
| `/` | No | `SignInPage` | Login/Signup page |
| `/auth/confirm` | No | `ConfirmPage` | Email verification success |
| `/welcomeMessage` | Yes | `WelcomePage` + `RedirectButton` | Welcome screen after login |
| `/dashboard` | Yes | `SideBar` + `NavBar` + `Dashboard` | Subject management grid |
| `/dashboard/[id]` | Yes | Same dashboard (with explicit user ID) | Legacy route |
| `/subject/[id]` | Yes | `SubjectPage` → `AIChatTab` / `NotesTab` / `StudyVideosTab` | Subject detail view with 3 tabs |

---

## 9. Middleware (proxy.js)

The file `proxy.js` in the project root acts as **Next.js middleware**. It runs on _every request_ (except static assets).

### What it does:
1. Creates a Supabase server client using request cookies
2. Checks if a user session exists (`supabase.auth.getUser()`)
3. Applies routing rules:
   - **Logged-in user visiting `/`** → Redirect to `/welcomeMessage`
   - **Unauthenticated user visiting `/dashboard/*`** → Redirect to `/`
   - **Unauthenticated user visiting `/welcomeMessage`** → Redirect to `/`
4. Refreshes session cookies on every request (keeps session alive)

### Matcher Pattern:
Excludes: `_next/static`, `_next/image`, `favicon.ico`, and static file extensions (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)

---

## 10. API Routes — Full Reference

### 10.1 Subject Management

#### `POST /api/addSubject`
- **Purpose:** Create a new subject with chapters, PDFs, and YouTube links
- **Auth:** Session-based (checks `supabase.auth.getSession()`)
- **Request:** `FormData` containing:
  - `metadata` (JSON string): subject name, chapter details, YouTube links
  - `syllabus_files`: PDF files for syllabus
  - `chapter_N_files`: PDF files per chapter
- **Response:** Server-Sent Events (streaming) with progress updates
- **Pipeline:** Creates Subject → Uploads PDFs to Storage → Processes PDFs through RAG pipeline (extract → chunk → embed → store) → Creates Chapter records → Saves YouTube links

#### `PUT /api/updateSubject`
- **Purpose:** Update an existing subject (rename, add new chapters/PDFs/videos)
- **Auth:** Session-based
- **Request:** `FormData` similar to addSubject + `subjectID`
- **Response:** Streaming progress events

#### `GET /api/getSubjects/[userId]`
- **Purpose:** Fetch all subjects for the dashboard view
- **Returns:** Array of subjects with chapter count and resource counts (by type)

#### `GET /api/getSubjectDetails/[subjectId]`
- **Purpose:** Fetch complete subject data including chapters, resources, syllabus, and videos
- **Returns:** Subject name, global syllabus, global videos, chapters (each with notes and YouTube links)

#### `DELETE /api/deleteSubject/[subjectId]`
- **Purpose:** Delete a subject and all associated data
- **Cleanup:** Removes PDFs from Supabase Storage (both `syllabus` and `user_notes` buckets), deletes DB records (cascade)

---

### 10.2 Video Management

#### `POST /api/addVideo`
- **Purpose:** Add a YouTube link or playlist to a subject/chapter
- **Auto-detection:** Detects if URL is a playlist (`playlist?list=` or `&list=`)
- **Sets `resource_type`:** `"YouTube Link"` or `"YouTube Playlist"`

#### `DELETE /api/deleteVideo/[resourceId]`
- **Purpose:** Delete a YouTube video resource
- **Validation:** Only deletes resources of type `"YouTube Link"` or `"YouTube Playlist"`

#### `GET /api/getPlaylistVideos/[playlistId]`
- **Purpose:** Fetch individual videos from a YouTube playlist
- **Method:** Parses YouTube RSS feed XML (`youtube.com/feeds/videos.xml?playlist_id=...`)
- **Returns:** Playlist title, array of videos with `videoId`, `title`, and `thumbnail`
- **No API Key Required:** Uses public RSS feed

---

### 10.3 PDF Management

#### `GET /api/getPdfUrl/[resourceId]`
- **Purpose:** Generate a signed URL for viewing a PDF in-browser
- **Security:** Verifies user owns the resource's subject
- **Output:** 1-hour signed URL from Supabase Storage

---

### 10.4 Chat / AI

#### `POST /api/chat`
- **Purpose:** Main RAG chat endpoint (streaming)
- **Request Body:** `{ query, subjectId, conversationId, resourceIds? }`
- **Response:** Server-Sent Events (newline-delimited JSON) with types:
  - `status`: Progress updates ("Verifying access...", "Encoding...", "Searching...", "Thinking...")
  - `reasoning`: LLM reasoning tokens (if model supports it)
  - `token`: Generated response tokens (streamed)
  - `done`: Completion signal with `citations` array
  - `error`: Error messages
- **Pipeline:** See [RAG Pipeline section](#11-rag-pipeline--deep-dive)

---

### 10.5 Conversation Management

#### `GET /api/conversations/[subjectId]`
- **Purpose:** List all conversations for a subject (sorted by newest first)

#### `POST /api/conversations/[subjectId]`
- **Purpose:** Create a new conversation
- **Request Body:** `{ title? }` (defaults to "New Conversation")

#### `PUT /api/conversation/[conversationId]`
- **Purpose:** Rename a conversation
- **Request Body:** `{ title }`

#### `DELETE /api/conversation/[conversationId]`
- **Purpose:** Delete a conversation (cascades to chat history)

---

### 10.6 Chat History

#### `GET /api/chatHistory/[conversationId]`
- **Purpose:** Fetch all messages in a conversation (sorted chronologically)

#### `DELETE /api/chatHistory/[conversationId]`
- **Purpose:** Clear all messages in a conversation

---

## 11. RAG Pipeline — Deep Dive

### Embedding Model
- **Model:** `BAAI/bge-base-en-v1.5` (hosted on Hugging Face)
- **Dimensions:** 768
- **Access:** REST API via Hugging Face Inference API
- **Why:** Avoids ONNX/native binary issues on Vercel deployment; produces high-quality embeddings for English text

### Text Chunking Strategy
- **Chunk Size:** 500 characters (default)
- **Overlap:** 50 characters
- **Boundary Detection:** Tries to break at sentence boundaries (`. `) or newlines when they occur in the latter half of the chunk
- **Safety:** Ensures forward progress by advancing at least 1 character per iteration

### Context Enhancement
Each chunk gets a **context summary** prefix before embedding:
```
Key information from "<document_title>": <first 100 chars of chunk>...
```
This combined text (`summary + "\n\n" + chunk`) produces more semantically rich embeddings.

### Vector Search (match_chunks RPC)
- Uses PostgreSQL `pgvector` extension for cosine similarity search
- Filters by `subject_id` and optionally by `resource_ids` (when using @ mentions)
- Returns top 10 matching chunks with similarity scores

### LLM Prompt Assembly
The final prompt sent to Groq consists of:
1. **System Prompt:** Formatting rules (Markdown hierarchy, no HTML, no citations) + Content rules (prioritize context, supplement with general knowledge if needed)
2. **User Message:** Context block (relevant document chunks) + Previous conversation history (last 10 messages) + Current question

### Streaming Architecture
Both the chat API and subject creation APIs use **ReadableStream** with **TextEncoder** to stream newline-delimited JSON events. This provides real-time feedback to the user.

---

## 12. Library / Utility Modules

### `lib/embeddings.js`
- Calls Hugging Face Inference API to generate 768-dim embeddings
- Uses `BAAI/bge-base-en-v1.5` model
- Gracefully returns empty array on failure (doesn't crash the request)

### `lib/pdfProcessor.js`
Contains the full ingestion pipeline:
1. `extractTextFromPdf(buffer)` — Uses `pdf-parse` to extract raw text
2. `chunkText(text, 500, 50)` — Splits text into overlapping chunks
3. `processPdfForRag(supabase, buffer, resourceId, title, onProgress)` — Full pipeline:
   - Extract text → Generate doc summary → Chunk text → Generate context summaries → Batch embed (5 at a time) → Store in `Vector_chunk` table
   - Reports progress via callback for streaming to frontend

### `lib/supabase/client.js`
- Browser-side Supabase client using `createBrowserClient()`
- Uses public env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)

### `lib/supabase/server.js`
- Server-side Supabase client using `createServerClient()`
- Reads/writes cookies via Next.js `cookies()` API
- Used in API routes and server components

### `lib/supabase/proxy.js`
- Middleware Supabase client using `createServerClient()`
- Manages session refresh on every request
- Used by `proxy.js` middleware

---

## 13. React Components — Full Reference

### Root Components

#### `SignInPage.jsx` (244 lines)
- Login and Signup forms with toggle between modes
- Email + Password authentication using Supabase
- Checks for existing session on mount → redirects if logged in
- Sub-components: `LoginForm`, `SignupForm`

#### `Dashboard.jsx` (190 lines)
- Displays a responsive grid of subject cards
- Fetches subjects via `/api/getSubjects/[userId]`
- Features: Add New Subject (opens `SubjectForm`), Edit Subject, Delete Subject
- Sub-component: `SubCard` — individual subject card showing name, chapter count, notes count, video count

#### `SubjectForm.jsx` (367 lines)
- Multi-step form for creating or editing subjects
- Fields: Subject Name, Syllabus PDFs, YouTube Videos, Chapters (each with name, notes, videos)
- Dynamic chapter management (add/delete chapters)
- Handles both create (`POST /api/addSubject`) and update (`PUT /api/updateSubject`) with streaming progress
- Uses `FormData` to send binary files along with JSON metadata
- Sub-component: `ChaptersForm` — individual chapter entry

#### `ConfirmSubject.jsx` (4KB)
- Confirmation dialog shown before subject submission
- Displays a summary of what will be created/updated

#### `DeleteSubject.jsx` (2KB)
- Delete confirmation modal with subject name
- Calls `DELETE /api/deleteSubject/[id]`

#### `DocInput.jsx` (4KB)
- PDF file upload input with drag-and-drop support
- Shows file names of selected PDFs

#### `YtInput.jsx` (3KB)
- YouTube URL input with title and link fields
- Supports adding multiple video entries

#### `NavBar.jsx` (2KB)
- Top navigation bar with app title

#### `SideBar.jsx` (5.5KB)
- Left sidebar navigation for the dashboard layout
- Responsive (collapsible on mobile)

#### `RedirectButton.jsx` (456 bytes)
- Simple button that redirects to `/dashboard`

#### `WelcomePage.jsx` (305 bytes)
- Displays "Welcome, {userName}" message

#### `ToastProvider.jsx` (552 bytes)
- Wraps `react-toastify` `ToastContainer` with custom dark theme styling

---

### Subject Components (`components/subject/`)

#### `SubjectPage.jsx` (207 lines)
- **Main controller** for the subject detail view
- Manages 3 tabs: `"chat"` | `"notes"` | `"videos"`
- Fetches subject data from `/api/getSubjectDetails/[id]`
- Handles tab transitions with fade animations
- Passes resource selection between sidebar and content tabs
- Shows loading skeleton during initial fetch
- Shows error state with retry button

#### `SubjectSidebar.jsx` (206 lines)
- Left sidebar showing:
  - Back to Dashboard button
  - Subject name
  - Tab navigation (AI Chat, Library, Videos)
  - Resource tree: Syllabus PDFs → Chapters (expandable) → Chapter PDFs + YouTube links
- **Fully responsive:**
  - Desktop: Fixed sidebar with collapsible chapters
  - Mobile: Header + bottom tab bar + resource drawer

#### `AIChatTab.jsx` (727 lines) — **Largest & most complex component**
- Full AI chat interface with:
  - **Conversation sidebar** (collapsible): Create, rename, delete conversations
  - **Message list** with user/assistant bubbles
  - **Markdown rendering** of AI responses (using `react-markdown` + `remark-gfm` + `remark-breaks`)
  - **Syntax highlighting** for code blocks (using `react-syntax-highlighter` + VSCode Dark Plus theme)
  - **Status indicators** showing RAG pipeline progress ("Searching documents...", "Thinking...")
  - **Reasoning blocks** (expandable) for chain-of-thought display
  - **Citations** panel showing source documents with similarity scores
  - **@ Mention system**: Type `@` to filter and select specific PDFs for targeted RAG search
  - **PDF filter chips** showing which documents are being queried
  - **Auto-scroll** with smart detection (doesn't auto-scroll if user scrolled up)
  - **Streaming response** handling (token-by-token rendering)
- Sub-components: `StatusIndicator`, `ReasoningBlock`, `Citations`, `MentionDropdown`

#### `NotesTab.jsx` (177 lines)
- In-browser PDF viewer using `<iframe>` with signed URLs
- Features: Zoom in/out (25% increments, 25%–200%), Download button
- Fetches signed URL from `/api/getPdfUrl/[resourceId]`
- Empty state, loading spinner, and error state with retry

#### `StudyVideosTab.jsx` (498 lines)
- YouTube video player with playlist support
- Features:
  - **Distraction-free embed**: YouTube iframe without related videos
  - **Video grid**: Thumbnails with click-to-play
  - **Playlist expansion**: Fetches playlist videos via YouTube RSS feed
  - **Add video form**: Add new YouTube links/playlists inline
  - **Delete video**: Remove videos with confirmation
  - **Playlist video selection**: Click individual videos from expanded playlists
- Helper functions: `getYouTubeId()`, `getPlaylistId()`, `getThumbnailUrl()`, `isValidYoutubeUrl()`
- Sub-component: `AddVideoForm`

#### `VideoNotes.jsx` (144 lines)
- Timestamped note-taking panel for videos
- **Stored in localStorage** (not in database)
- Features: Add notes with timestamp, delete notes, sortable by timestamp
- Expandable panel below the video player

---

## 14. Styling & Design System

### Theme
Dark theme with these design tokens (defined in `globals.css`):

| Token | Value | Usage |
|---|---|---|
| `--color-brand-bg` | `rgb(25, 25, 25)` | Page background |
| `--color-brand-card` | `rgb(32, 32, 32)` | Card/panel backgrounds |
| `--color-brand-border` | `rgb(51, 51, 51)` | Border colors |
| `--color-brand-text-primary` | `#ffffff` | Primary text |
| `--color-brand-text-secondary` | `rgb(155, 154, 151)` | Secondary/muted text |

### CSS Files
1. **`globals.css`** (107 lines) — Theme variables, animations (`fadeIn`, `slideUp`, `breathe`), custom scrollbar
2. **`subject.css`** (~51KB) — Extensive styles for the subject page (sidebar, tabs, chat interface, notes viewer, video player, responsive breakpoints)

### Fonts
- **Geist** (sans-serif) — Primary font
- **Geist Mono** (monospace) — Code/mono font

### Animations
| Animation | Usage |
|---|---|
| `fadeIn` | General element entrance |
| `slideUp` | Subject cards entrance |
| `breathe` | Welcome page text pulsing effect |

---

## 15. Scripts & Tooling

### `scripts/revectorize.js`
A **standalone CLI script** to re-process all existing PDFs through the RAG pipeline.

**When to use:** If you change the embedding model, chunking strategy, or need to rebuild all vectors.

**What it does:**
1. Loads `.env.local` environment variables manually
2. Connects to Supabase using service role key
3. Fetches all PDF resources from the `Resources` table
4. For each PDF:
   - Deletes existing vectors from `Vector_chunk`
   - Downloads PDF from Supabase Storage
   - Extracts text → chunks (800 chars, 100 overlap) → embeds via HuggingFace → stores vectors
5. Includes rate limiting (600ms delay between chunks) for HuggingFace free tier

**Run:** `node scripts/revectorize.js`

### NPM Scripts
| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start development server |
| `build` | `next build` | Build for production |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run linting |

---

## 16. Key Features Summary

| Feature | Implementation |
|---|---|
| **Email/Password Auth** | Supabase Auth with email confirmation |
| **Subject Management** | Full CRUD (Create, Read, Update, Delete) |
| **Chapter Organization** | Subjects → Chapters → Resources hierarchy |
| **PDF Upload & Storage** | Supabase Storage (signed URLs for secure viewing) |
| **RAG Chatbot** | HuggingFace embeddings + pgvector search + Groq LLM |
| **Streaming Responses** | Real-time token streaming via Server-Sent Events |
| **@ Mention PDF Filter** | Type `@` in chat to query specific documents |
| **Conversation Management** | Multiple conversations per subject with rename/delete |
| **Chat History** | Persistent per-conversation message history |
| **Citations** | Source documents shown with similarity scores |
| **YouTube Video Player** | Distraction-free iframe embed |
| **YouTube Playlist Support** | Auto-expands playlists via RSS feed |
| **Video Notes** | Timestamped notes stored in localStorage |
| **PDF Viewer** | In-browser with zoom/download controls |
| **Responsive Design** | Mobile-first with sidebar drawer, bottom tabs |
| **Error Handling** | Global error boundary, per-page error states |
| **Toast Notifications** | Success/error feedback via react-toastify |

---

## 17. FAQ / Common Questions

### Q: What AI model does the chatbot use?
**A:** The chatbot uses **Llama 3.3 70B Versatile** via the **Groq Cloud API**. Groq provides very fast inference speeds. The project also has a Gemini API key configured as a potential alternative.

### Q: How does the chatbot know about my notes?
**A:** Through **Retrieval-Augmented Generation (RAG)**. When you upload a PDF, it is processed into text chunks, each chunk is converted into a 768-dimensional vector using the **BAAI/bge-base-en-v1.5** embedding model on Hugging Face. When you ask a question, your question is also embedded and a cosine similarity search finds the most relevant chunks from your documents.

### Q: Where are uploaded files stored?
**A:** In **Supabase Storage**. Syllabus PDFs go in the `syllabus` bucket and chapter notes go in the `user_notes` bucket. When viewing a PDF, a signed URL (valid for 1 hour) is generated for secure access.

### Q: What is the Vector_chunk table?
**A:** It stores the text chunks from your PDFs along with their 768-dimensional embedding vectors. The `pgvector` extension in PostgreSQL enables fast cosine similarity searches on these vectors.

### Q: How does the @ mention system work in chat?
**A:** When you type `@` in the chat input, a dropdown appears listing all PDFs in the current subject. Selecting a PDF adds it as a filter — the RAG search will only look through chunks from the selected document(s) instead of all documents.

### Q: How are YouTube playlists handled?
**A:** Playlist URLs are detected automatically (`playlist?list=` or `&list=`). When expanded, the app fetches the playlist's RSS feed from YouTube (`youtube.com/feeds/videos.xml?playlist_id=...`) and parses the XML to extract individual video IDs and titles. No YouTube API key is needed.

### Q: What happens when I delete a subject?
**A:** Cascading deletion:
1. Subject record is deleted from the `Subject` table
2. All related Chapters, Resources, Chat_history, Conversations, and Vector_chunks are deleted (via database CASCADE)
3. PDF files are removed from Supabase Storage (both `syllabus` and `user_notes` buckets)

### Q: How does authentication work?
**A:** Email + Password via Supabase Auth. After signup, users must confirm their email. Sessions are managed via cookies using the `@supabase/ssr` library. The middleware (`proxy.js`) protects routes and handles redirects.

### Q: What is the `revectorize.js` script for?
**A:** It's a maintenance script that deletes all existing vector embeddings and re-processes every PDF through the RAG pipeline. Useful when changing the embedding model or chunking strategy.

### Q: How does streaming work?
**A:** Both the chat API and subject creation API use **ReadableStream** to send newline-delimited JSON objects. Each line is a JSON object with a `type` field (`status`, `token`, `reasoning`, `done`, `error`). The frontend reads these with a reader and updates the UI in real-time.

### Q: What is the difference between `subject.css` and `globals.css`?
**A:** `globals.css` defines the global theme (colors, fonts, animations) and is ~107 lines. `subject.css` is ~51KB and contains all the detailed styles for the subject page (sidebar, chat interface, notes viewer, video player, responsive breakpoints).

### Q: What are proxy.js and lib/supabase/proxy.js?
**A:** The root `proxy.js` is the **Next.js middleware** that runs on every request for authentication checks and route protection. `lib/supabase/proxy.js` contains the Supabase client factory used specifically within the middleware context.

### Q: How is the project deployed?
**A:** On **Vercel**. The Next.js App Router is fully compatible with Vercel's serverless architecture. API routes run as serverless functions, and the frontend is statically/dynamically rendered.

---

> **Document Generated:** March 7, 2026
> **Project:** AI Study Buddy (College Major Project)
> **Framework:** Next.js 16 + React 19 + Supabase + Groq + HuggingFace
