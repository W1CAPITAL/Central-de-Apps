import { DurableObject } from "cloudflare:workers";
import { Lifecycle } from "agents/lifecycle";
import { OpenCodeWorkerd } from "@opencode/sdk/workerd";
import { OpenCodeHarness } from "agents/harness/opencode";
import { createAI } from "agents/models/opencode";
import workerTools from "./worker-tools.js";
import { authenticatedIdentity, promptFromBody } from "./security.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export class Assistant extends DurableObject {
  ai = createAI({ binding: this.env.AI });
  harness = new OpenCodeHarness({
    opencode: ({ storage }) => OpenCodeWorkerd.create({
      storage,
      config: { default_agent: "build" },
      models: { fetch: false },
      plugins: [this.ai.plugin, workerTools],
    }),
    defaults: {
      model: this.ai("@cf/openai/gpt-oss-20b", { reasoningEffort: "low" }),
      agent: "build",
    },
  });
  lifecycle = Lifecycle.install(this).use(this.harness);
  async ask(prompt) {
    const { status, text, reason } = await this.harness.prompt(prompt);
    return { status, text: text || "", reason: reason || null };
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/health" && url.pathname !== "/api/chat") {
      return json({ error: "Rota inexistente" }, 404);
    }
    const identity = await authenticatedIdentity(request.headers.get("Authorization"), env);
    if (!identity) return json({ error: "Sessão expirada ou acesso não autorizado" }, 401);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, runtime: "opencode-workerd", pcRequired: false });
    }
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }
    if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
      return json({ error: "Envie JSON" }, 415);
    }
    const contentLength = Number(request.headers.get("Content-Length") || "0");
    if (contentLength > 16000) return json({ error: "Mensagem muito grande" }, 413);
    let prompt;
    try { prompt = promptFromBody(await request.text()); }
    catch (error) { return json({ error: error.message }, 400); }
    try {
      // Cada conta tem sessão isolada; tokens do usuário não identificam objetos diretamente.
      const assistant = env.Assistant.getByName(identity);
      const result = await assistant.ask(prompt);
      return json(result);
    } catch {
      return json({ error: "Falha do OpenCode ou do provedor de IA. Consulte os logs privados." }, 502);
    }
  },
};
