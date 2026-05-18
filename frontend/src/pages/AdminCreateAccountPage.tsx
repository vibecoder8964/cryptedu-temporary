import { useState } from "react";
import { ShieldPlus, AlertCircle, CheckCircle, Loader2, Mail, KeyRound, UserPlus } from "lucide-react";
import type { AdminCreateAccountRequest } from "../lib/types";

/**
 * AdminCreateAccountPage — provisions a new Cognito_User and a matching
 * `users` row via `POST /api/admin/create-account`.
 *
 * Implements Requirement 1.2: an admin authenticated against the Cognito
 * User Pool can create another admin by supplying an email (3..32 chars,
 * also ≤ 254 chars and a valid email shape) and a password (≥ 8 chars).
 * The backend wraps `cognito.admin_create_user` + `admin_set_user_password`
 * (Permanent=true) and inserts the corresponding `users` row keyed by the
 * Cognito email so Per_User_Credentials can later be stored against it
 * (Requirement 1.13).
 *
 * On non-OK responses the backend's `detail` string is shown verbatim in
 * the error region — the spec brief is explicit that we surface backend
 * messages as-is so admins see real Cognito errors (UsernameExists,
 * InvalidPassword, IAM AccessDenied, …) rather than a polished placeholder.
 */
export default function AdminCreateAccountPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const body: AdminCreateAccountRequest = {
        username: username.trim(),
        password,
      };

      const apiBase = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/admin/create-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // The backend returns `{ "detail": "<reason>" }` on every 4xx /
        // 5xx path (validation, Cognito ClientError, BotoCoreError,
        // misconfigured user pool). Surface it verbatim so admins see
        // the real failure cause.
        let detail = `Request failed (HTTP ${res.status})`;
        try {
          const data = await res.json();
          if (data && typeof data.detail === "string" && data.detail.length > 0) {
            detail = data.detail;
          }
        } catch {
          // Response wasn't JSON — keep the generic detail above.
        }
        setError(detail);
        return;
      }

      // 200 OK path. The backend returns `{ ok, email, user_id }`; we
      // confirm by quoting back the email the caller submitted.
      setSuccess(`Created admin ${body.username}`);
      setUsername("");
      setPassword("");
    } catch (err: unknown) {
      // Network failure (CORS, DNS, fetch aborted). No backend `detail`
      // to surface — fall back to the JS error message.
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#163e2c] mb-1 flex items-center gap-2">
          <ShieldPlus size={24} />
          Create Admin Account
        </h2>
        <p className="text-sm text-gray-500">
          Provision a new Cognito admin. The new account will be able to sign in
          immediately with the password you set here.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm space-y-5"
      >
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 text-sm"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="break-words whitespace-pre-wrap">{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-lg p-3 text-sm"
          >
            <CheckCircle size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="admin-create-username" className="text-sm font-semibold text-gray-700">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail size={16} className="text-gray-400" />
            </div>
            <input
              id="admin-create-username"
              type="email"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={254}
              placeholder="new-admin@school.edu.my"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#163e2c] focus:border-[#163e2c] outline-none transition-all"
            />
          </div>
          <p className="text-xs text-gray-400">
            3-32 characters. Must be a valid email no longer than 254 characters.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-create-password" className="text-sm font-semibold text-gray-700">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <KeyRound size={16} className="text-gray-400" />
            </div>
            <input
              id="admin-create-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#163e2c] focus:border-[#163e2c] outline-none transition-all"
            />
          </div>
          <p className="text-xs text-gray-400">
            At least 8 characters. The password is set as permanent — the new
            admin signs in with it directly, no welcome email is sent.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#163e2c] text-white rounded-lg font-semibold hover:bg-[#1b4b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Create Admin
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 bg-[#f0f7f4] rounded-xl p-4 border border-[#d1e7dd]">
        <h4 className="font-semibold text-[#163e2c] mb-2 flex items-center gap-2">
          <ShieldPlus size={16} />
          What happens next
        </h4>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>The email is registered in the AWS Cognito user pool with a permanent password.</li>
          <li>A matching admin row is created so Per-User Credentials can be saved against it.</li>
          <li>The new admin can sign in at the admin login page using these credentials.</li>
          <li>If the email already exists, Cognito will surface a clear error here.</li>
        </ul>
      </div>
    </div>
  );
}
