const encoder = new TextEncoder();

export function authorized(header, secret) {
  if (typeof secret !== "string" || secret.length < 24 || secret.length > 512) return false;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const candidate = header.slice(7);
  if (!candidate || candidate.length > 512) return false;
  const a = encoder.encode(candidate);
  const b = encoder.encode(secret);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
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
