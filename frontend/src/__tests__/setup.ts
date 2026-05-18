// Global test setup for the CryptEdu frontend.
//
// Responsibilities:
//   1. Extend the Vitest `expect` with Jest-DOM matchers so component tests
//      can use `toBeInTheDocument`, `toHaveTextContent`, etc.
//   2. Spin up an MSW (`msw/node`) server with a default catch-all handler
//      for `/api/*` so any unmocked request fails loudly. Per-test handlers
//      override these defaults via `server.use(...)`.
//
// Tests are encouraged to call `server.use(http.get('/api/...', ...))`
// inside `beforeEach` blocks to install the specific mock they need.

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Default handlers: every API call falls through to a 501 so the test author
// is forced to register an explicit mock for the surface under test. This
// prevents accidental network calls and silent passes.
const defaultHandlers = [
  http.all("/api/*", ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      {
        detail: `Unhandled ${request.method} ${url.pathname} in MSW. Override with server.use(...) in your test.`,
      },
      { status: 501 },
    );
  }),
];

export const server = setupServer(...defaultHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  // Reset per-test overrides so handlers do not leak between tests.
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
