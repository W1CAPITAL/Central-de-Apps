const encoder = new TextEncoder();

export function authorized(header, secret) {
  if (typeof secret !== "string" || secret.length < 24 || secret.length > 512) return false;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const candidate = header.slice(7);
  if (!candidate || candidate.length > 512) return false;
  const a = encoder.encode(candidate);
  const b = encoder.encode(secret);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return mismatch === 0;
}

export async function authenticatedIdentity(header, env, fetcher = fetch) {
  if (authorized(header, env.MOBILE_API_TOKEN)) return "legacy-owner";
  if (!header?.startsWith("Bearer ") || header.length > 8199) return null;
  const token = header.slice(7);
  if (token.length < 32 || token.length > 8192 || !/^[A-Za-z0-9._~-]+$/.test(token)) return null;
  if (!env.SUPABASE_URL?.startsWith("https://") || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    const result = await fetcher(env.SUPABASE_URL + "/auth/v1/user", {
      method: "GET",
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) return null;
    const user = await result.json();
    return typeof user?.id === "string" && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(user.id)
      ? "w1-user-" + user.id.toLowerCase() : null;
  } catch { return null; }
}

export function promptFromBody(raw) {
  if (typeof raw !== "string" || raw.length > 16000) throw new Error("Tamanho inválido");
  let payload;
  try { payload = JSON.parse(raw); } catch { throw new Error("JSON inválido"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      typeof payload.prompt !== "string") throw new Error("Prompt obrigatório");
  const prompt = payload.prompt.trim();
  if (!prompt || prompt.length > 12000) throw new Error("Prompt deve ter de 1 a 12000 caracteres");
  return prompt;
}
