// Smoke test for the TypeScript test scaffolding (Task 1.8).
//
// Confirms three things:
//   1. The shared types module compiles and is reachable from a test file.
//   2. fast-check is wired up and can run a trivial property.
//   3. Vitest globals (`describe`, `it`, `expect`) are available without
//      explicit imports thanks to `test.globals = true` in vitest.config.ts.

import * as fc from "fast-check";
import type {
  AIChatRequest,
  CognitoExchangeRequest,
  EndUserChatMessage,
  VideoTranscriptResponse,
} from "../lib/types";

describe("frontend test scaffolding smoke", () => {
  it("imports shared types and constructs DTO shapes", () => {
    // Each construction below would fail to compile if the type were missing
    // or had drifted, which is the actual assertion this test makes.
    const transcript: VideoTranscriptResponse = {
      title: "t",
      description: "d",
      transcription_paragraph: "p",
      schema_version: 1,
    };
    const chatReq: AIChatRequest = {
      messages: [{ role: "user", content: "hi" }],
      topic_scope: transcript.transcription_paragraph,
    };
    const cognitoReq: CognitoExchangeRequest = { id_token: "abc" };
    const chatMsg: EndUserChatMessage = {
      id: 1,
      video_key: "videos/intro.mp4",
      role: "tutor",
      text: "ok",
      created_at: new Date().toISOString(),
    };

    expect(transcript.schema_version).toBe(1);
    expect(chatReq.messages).toHaveLength(1);
    expect(cognitoReq.id_token).toBe("abc");
    expect(chatMsg.role).toBe("tutor");
  });

  it("runs a fast-check property", () => {
    fc.assert(fc.property(fc.string(), (s) => s.length >= 0));
  });
});
