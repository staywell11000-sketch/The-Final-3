const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")

/**
 * Checks whether an email address has a registered account in our system.
 * Used to show precise error messages on sign-in and sign-up without leaking
 * unrelated auth internals.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/check-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!data.exists
  } catch {
    return false
  }
}
