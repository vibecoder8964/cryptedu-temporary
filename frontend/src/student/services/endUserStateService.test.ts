// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for endUserStateService.js (spec task 2.20).
//
// Coverage:
//   * loadEndUserState parses ``value_json`` strings into native JS values.
//   * saveEndUserState wraps the payload with ``JSON.stringify(value)``
//     and a ``Content-Type: application/json`` header.
//   * loadEndUserChat / appendEndUserChat round-trip the ``video_key``
//     and reject invalid roles client-side without a network call.
//   * Non-2xx responses surface the backend ``detail`` verbatim with
//     ``error.status`` set so the caller can branch on 401.
//   * invalidateLocalStateCache drops the persisted ``cryptedu-state``
//     entry — the localStorage hygiene Requirement 1.8 demands.
// ─────────────────────────────────────────────────────────────────────────────

import { http, HttpResponse } from "msw";
import { server } from "../../__tests__/setup";
import {
  appendEndUserChat,
  invalidateLocalStateCache,
  loadEndUserChat,
  loadEndUserState,
  saveEndUserState,
} from "./endUserStateService";

describe("endUserStateService — state", () => {
  it("loadEndUserState parses each value_json string into native JS", async () => {
    server.use(
      http.get("/api/end-users/state", () =>
        HttpResponse.json({
          state: {
            progress: JSON.stringify({ "1": 50 }),
            quizResults: JSON.stringify([{ score: 4, total: 5 }]),
            streak: JSON.stringify(7),
          },
        }),
      ),
    );

    const out = await loadEndUserState();
    expect(out).toEqual({
      progress: { "1": 50 },
      quizResults: [{ score: 4, total: 5 }],
      streak: 7,
    });
  });

  it("loadEndUserState falls back to the raw string when value is not JSON", async () => {
    server.use(
      http.get("/api/end-users/state", () =>
        HttpResponse.json({ state: { junk: "not-json{{" } }),
      ),
    );

    const out = await loadEndUserState();
    expect(out.junk).toBe("not-json{{");
  });

  it("loadEndUserState surfaces the backend detail verbatim on a non-2xx", async () => {
    server.use(
      http.get("/api/end-users/state", () =>
        HttpResponse.json(
          { detail: "Not authenticated as an end user" },
          { status: 401 },
        ),
      ),
    );

    await expect(loadEndUserState()).rejects.toMatchObject({
      message: "Not authenticated as an end user",
      status: 401,
    });
  });

  it("saveEndUserState posts a JSON-stringified value with the matching key", async () => {
    let captured: { key?: string; value_json?: string } = {};
    server.use(
      http.post("/api/end-users/state", async ({ request }) => {
        captured = (await request.json()) as { key: string; value_json: string };
        return HttpResponse.json({ ok: true });
      }),
    );

    await saveEndUserState("progress", { "1": 50, "2": 30 });

    expect(captured.key).toBe("progress");
    expect(captured.value_json).toBe(JSON.stringify({ "1": 50, "2": 30 }));
  });

  it("saveEndUserState rejects an empty key without making a network call", async () => {
    // No handler installed — the default 501 catch-all would trigger
    // if a request escaped, so the assertion below proves the guard.
    await expect(saveEndUserState("", { a: 1 })).rejects.toThrow(/non-empty string/);
  });
});

describe("endUserStateService — chat", () => {
  it("loadEndUserChat encodes the video_key into the query string", async () => {
    let capturedUrl = "";
    server.use(
      http.get("/api/end-users/chat", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          messages: [
            {
              id: 1,
              video_key: "videos/intro lesson.mp4",
              role: "student",
              text: "hi",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }),
    );

    const out = await loadEndUserChat("videos/intro lesson.mp4");
    expect(capturedUrl).toContain(
      `video_key=${encodeURIComponent("videos/intro lesson.mp4")}`,
    );
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("student");
  });

  it("loadEndUserChat returns [] when the backend omits ``messages``", async () => {
    server.use(
      http.get("/api/end-users/chat", () => HttpResponse.json({})),
    );
    const out = await loadEndUserChat("videos/x.mp4");
    expect(out).toEqual([]);
  });

  it("appendEndUserChat posts {video_key, role, text} verbatim", async () => {
    let captured: any = {};
    server.use(
      http.post("/api/end-users/chat", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    await appendEndUserChat("videos/x.mp4", "tutor", "let me explain");

    expect(captured).toEqual({
      video_key: "videos/x.mp4",
      role: "tutor",
      text: "let me explain",
    });
  });

  it("appendEndUserChat rejects an invalid role client-side", async () => {
    // The backend would also reject this with 400, but rejecting in
    // the service stops the round trip — and proves the type narrow
    // is in force.
    await expect(
      // @ts-expect-error — testing the runtime guard
      appendEndUserChat("videos/x.mp4", "admin", "nope"),
    ).rejects.toThrow(/role must be/);
  });

  it("appendEndUserChat surfaces the backend detail on 400", async () => {
    server.use(
      http.post("/api/end-users/chat", () =>
        HttpResponse.json(
          { detail: "role field invalid: must be 'student' or 'tutor'" },
          { status: 400 },
        ),
      ),
    );

    await expect(
      appendEndUserChat("videos/x.mp4", "tutor", "ok"),
    ).rejects.toMatchObject({
      message: "role field invalid: must be 'student' or 'tutor'",
      status: 400,
    });
  });
});

describe("endUserStateService — invalidateLocalStateCache", () => {
  it("removes the cryptedu-state entry from localStorage", () => {
    localStorage.setItem("cryptedu-state", '{"progress":{"1":50}}');
    expect(localStorage.getItem("cryptedu-state")).not.toBeNull();

    invalidateLocalStateCache();

    expect(localStorage.getItem("cryptedu-state")).toBeNull();
  });

  it("is a no-op when the key is absent", () => {
    localStorage.removeItem("cryptedu-state");
    expect(() => invalidateLocalStateCache()).not.toThrow();
  });
});
