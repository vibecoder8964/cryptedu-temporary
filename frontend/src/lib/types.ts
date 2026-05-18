export type FileEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  ext: "pdf" | "docx" | "doc" | "txt";
  role: "textbook" | "question" | "answer";
};

export type ExamPair = {
  pairId: string;
  question: FileEntry;
  answer: FileEntry;
};

export type TrainingDataset = {
  version: string;
  created: string;
  priority_rule: "exam_over_textbook";
  training_config: {
    base_model: string;
    method: string;
    target_accuracy: number;
    language: string;
    domain: string;
    exam_weight_multiplier: number;
    instruction_template: string;
  };
  textbooks: { filename: string; size_bytes: number; format: string; role: string }[];
  exam_pairs: {
    pair_id: number;
    question_file: string;
    answer_file: string;
    priority: number;
    role: string;
  }[];
  colab_instructions: {
    drive_folder: string;
    textbook_subfolder: string;
    exam_q_subfolder: string;
    exam_a_subfolder: string;
    manifest_filename: string;
  };
};

export type Page = "textbooks" | "exam" | "ready";

// ---------------------------------------------------------------------------
// Backend DTOs for the CryptEdu platform refinement (Requirements 1.2, 1.10,
// 2.1, 2.4, 2.6). Field names mirror the FastAPI route shapes documented in
// the spec design — change them here only if the backend contract changes.
// ---------------------------------------------------------------------------

// ---- End_User_App AI surface (Requirements 2.1, 2.4, 2.6) -----------------

/**
 * Response body of `GET /api/videos/{key:path}/transcript`.
 *
 * Reverse-lookup against the S3_Companion_JSON sibling object. The
 * `transcription_paragraph` is bound as the Topic_Scope on every subsequent
 * Local_AI_Tutor and Quiz_Generator request in the active session.
 */
export interface VideoTranscriptResponse {
  title: string;
  description: string;
  transcription_paragraph: string;
  schema_version: number;
}

/** Single chat turn forwarded to the Local_AI_Tutor. */
export interface AIChatMessage {
  // The backend rejects role:"system" entries before forwarding to Ollama —
  // Topic_Scope binding happens server-side via `topic_scope`.
  role: "user" | "assistant";
  content: string;
}

/**
 * Request body of `POST /api/ai/chat`.
 *
 * `topic_scope` is the active video's `transcription_paragraph` and is the
 * only knowledge source the Local_AI_Tutor is allowed to draw from.
 */
export interface AIChatRequest {
  messages: AIChatMessage[];
  topic_scope: string;
  options?: {
    temperature?: number;
    min_p?: number;
  };
}

/**
 * Request body of `POST /api/ai/generate-quiz`.
 *
 * `format` defaults server-side to `{ mcq_count: 10, subjective_count: 5 }`
 * when omitted. `mcq_count` must be 1..50 inclusive; `subjective_count`
 * must be 0..50 inclusive.
 */
export interface QuizGenerateRequest {
  prompt: string;
  topic_scope: string;
  format?: {
    mcq_count: number;
    subjective_count: number;
  };
}

// ---- Per-account isolation: end-user state and chat (Requirement 1.10) ----

/**
 * Response body of `GET /api/end-users/state`.
 *
 * Returns the full state map for the authenticated end user, keyed by
 * `state_key`. Values are JSON-encoded strings as persisted in the
 * `end_user_state` table.
 */
export interface EndUserStateResponse {
  state: Record<string, string>;
}

/**
 * Request body of `POST /api/end-users/state`.
 *
 * Upserts a single (key, value) pair for the authenticated end user.
 * The backend resolves `end_user_id` from the session cookie and never
 * trusts a request-body identifier.
 */
export interface EndUserStateUpdateRequest {
  key: string;
  value_json: string;
}

/** Author of a chat turn persisted in `end_user_chat`. */
export type EndUserChatRole = "student" | "tutor";

/** A single chat row as returned by `GET /api/end-users/chat`. */
export interface EndUserChatMessage {
  id: number;
  video_key: string;
  role: EndUserChatRole;
  text: string;
  created_at: string;
}

/**
 * Response body of `GET /api/end-users/chat?video_key=...`.
 *
 * Messages are scoped to `(end_user_id, video_key)` so the Topic_Scope
 * binding from the video carries through to the AI_Context_Window.
 */
export interface EndUserChatListResponse {
  messages: EndUserChatMessage[];
}

/**
 * Request body of `POST /api/end-users/chat`.
 *
 * Appends a single chat turn for the authenticated end user. The
 * `end_user_id` is taken from the session cookie, not from the body.
 */
export interface EndUserChatAppendRequest {
  video_key: string;
  role: EndUserChatRole;
  text: string;
}

// ---- Admin auth (Requirements 1.2, 1.13) ---------------------------------

/**
 * Request body of `POST /api/admin/create-account`.
 *
 * `username` must be 3..32 chars and a valid email no longer than 254
 * chars. `password` must be at least 8 chars. The backend creates a
 * Cognito_User with `MessageAction=SUPPRESS` and a permanent password,
 * then ensures a matching `users` row keyed by `username`.
 */
export interface AdminCreateAccountRequest {
  username: string;
  password: string;
}

/**
 * Request body of `POST /api/auth/cognito-exchange`.
 *
 * The Admin_App sends the Cognito ID token obtained from Amplify after
 * `signIn` succeeds. The backend verifies the token, ensures a `users`
 * row exists for `username = cognito_email`, and issues the backend
 * session cookie used by every `/api/v1/*` route.
 */
export interface CognitoExchangeRequest {
  id_token: string;
}

/** Response body of `POST /api/auth/cognito-exchange`. */
export interface CognitoExchangeResponse {
  ok: boolean;
  email: string;
}
