package br.com.w1capital.opencode;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** W1 standalone OpenCode client: the SDK runs in Cloudflare, not on a PC. */
public final class MainActivity extends Activity {
    private static final int BACKGROUND = Color.rgb(20, 15, 21);
    private static final int PANEL = Color.rgb(39, 28, 38);
    private static final int TEXT = Color.rgb(248, 237, 240);
    private static final int MUTED = Color.rgb(194, 171, 183);
    private static final int WINE = Color.rgb(142, 44, 79);
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private EditText server, secret, prompt;
    private Button connect, send;
    private TextView status, transcript;
    private ScrollView scroll;
    private CredentialVault vault;
    private boolean busy;

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private GradientDrawable panel(int color) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color); shape.setCornerRadius(dp(14)); return shape;
    }
    private TextView text(String value, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }
    private EditText entry(String placeholder, boolean password, boolean multiline) {
        EditText e = new EditText(this);
        e.setTextColor(TEXT); e.setHintTextColor(MUTED); e.setTextSize(14); e.setSingleLine(!multiline);
        e.setHint(placeholder);
        e.setPadding(dp(14), dp(12), dp(14), dp(12));
        e.setBackground(panel(PANEL));
        if (password) e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        else if (multiline) {
            e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            e.setMinLines(3); e.setGravity(Gravity.TOP);
        } else e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        return e;
    }
    private Button action(String label) {
        Button b = new Button(this);
        b.setAllCaps(false); b.setText(label); b.setTextColor(TEXT); b.setTextSize(14);
        b.setBackgroundTintList(ColorStateList.valueOf(WINE)); b.setMinHeight(dp(48));
        return b;
    }
    private void add(LinearLayout root, View child, int gap) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.bottomMargin = dp(gap); root.addView(child, p);
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND); getWindow().setNavigationBarColor(BACKGROUND);
        vault = new CredentialVault(this);
        scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(BACKGROUND);
        LinearLayout content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(26), dp(20), dp(30)); scroll.addView(content);
        add(content, text("W1 CAPITAL", 12, MUTED, true), 6);
        add(content, text("OpenCode Mobile", 27, TEXT, true), 8);
        add(content, text("IA e sessões na nuvem. Não precisa parear com PC.", 14, MUTED, false), 22);
        add(content, text("SERVIDOR CLOUDFLARE", 12, MUTED, true), 8);
        server = entry("https://seu-worker.workers.dev", false, false);
        server.setText(getPreferences(MODE_PRIVATE).getString("server_url", ""));
        add(content, server, 10);
        secret = entry("Senha exclusiva do Worker", true, false);
        secret.setText(vault.load()); add(content, secret, 10);
        connect = action("Conectar sem PC"); add(content, connect, 8);
        status = text("Configure o Worker uma única vez e conecte.", 13, MUTED, false);
        add(content, status, 24);
        add(content, text("CONVERSA", 12, MUTED, true), 10);
        transcript = text("O OpenCode usará o SDK na Cloudflare.", 15, TEXT, false);
        transcript.setPadding(dp(14), dp(14), dp(14), dp(14));
        transcript.setBackground(panel(PANEL)); transcript.setTextIsSelectable(true);
        add(content, transcript, 14);
        prompt = entry("Descreva a tarefa para o OpenCode...", false, true); add(content, prompt, 10);
        send = action("Enviar ao OpenCode"); add(content, send, 12);
        add(content, text("Modelo remoto sujeito às cotas Cloudflare. Ferramentas locais do PC não estão disponíveis neste modo.", 12, MUTED, false), 0);
        setContentView(scroll);
        connect.setOnClickListener(v -> request(false));
        send.setOnClickListener(v -> request(true));
    }
    private void toggle(boolean loading) {
        busy = loading; connect.setEnabled(!loading); send.setEnabled(!loading);
    }
    private void update(String message) { status.setText(message); }
    private void append(String message) {
        String old = transcript.getText().toString();
        String next = old + "\n\n" + message;
        if (next.length() > 30000) next = next.substring(next.length() - 30000);
        transcript.setText(next);
        scroll.post(() -> scroll.fullScroll(View.FOCUS_DOWN));
    }
    private static String body(InputStream in) throws Exception {
        if (in == null) return "";
        try (InputStream stream = in; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[4096]; int count;
            while ((count = stream.read(chunk)) != -1) {
                if (bytes.size() > 1024 * 1024) throw new IllegalArgumentException("Resposta excessiva.");
                bytes.write(chunk, 0, count);
            }
            return bytes.toString("UTF-8");
        }
    }
    private void request(boolean chat) {
        if (busy) return;
        final String url, token, message;
        try { url = Endpoint.normalize(server.getText().toString()); }
        catch (IllegalArgumentException e) { update(e.getMessage()); return; }
        token = secret.getText().toString().trim();
        if (token.length() < 24) { update("Informe a senha do Worker com no mínimo 24 caracteres."); return; }
        message = prompt.getText().toString().trim();
        if (chat && (message.isEmpty() || message.length() > 12000)) {
            update("Digite uma mensagem com até 12.000 caracteres."); return;
        }
        toggle(true); update(chat ? "Aguardando resposta do OpenCode..." : "Testando conexão...");
        io.execute(() -> {
            HttpURLConnection conn = null;
            String result = null, error = null;
            try {
                conn = (HttpURLConnection) new URL(url + (chat ? "/api/chat" : "/api/health")).openConnection();
                conn.setRequestMethod(chat ? "POST" : "GET");
                conn.setConnectTimeout(15000); conn.setReadTimeout(120000);
                conn.setUseCaches(false);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Accept", "application/json");
                if (chat) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    byte[] json = new JSONObject().put("prompt", message).toString().getBytes(StandardCharsets.UTF_8);
                    conn.setFixedLengthStreamingMode(json.length);
                    try (OutputStream out = conn.getOutputStream()) { out.write(json); }
                }
                int statusCode = conn.getResponseCode();
                String response = body(statusCode >= 400 ? conn.getErrorStream() : conn.getInputStream());
                JSONObject parsed = new JSONObject(response);
                if (statusCode != 200) throw new IllegalStateException(parsed.optString("error", "HTTP " + statusCode));
                if (chat) {
                    String answer = parsed.optString("text", "");
                    if (!"done".equals(parsed.optString("status"))) throw new IllegalStateException(parsed.optString("reason", "O agente não concluiu a tarefa."));
                    result = answer.isEmpty() ? "Concluído, sem resposta em texto." : answer;
                } else if (!parsed.optBoolean("ok", false)) {
                    throw new IllegalStateException("O servidor não confirmou a conexão.");
                } else result = "Conectado ao OpenCode sem precisar de computador.";
            } catch (Exception e) {
                error = e.getMessage() == null ? "Não foi possível comunicar com o Worker." : e.getMessage();
            } finally { if (conn != null) conn.disconnect(); }
            final String reply = result, failure = error;
            main.post(() -> {
                toggle(false);
                if (failure != null) { update("Erro: " + failure); return; }
                getPreferences(MODE_PRIVATE).edit().putString("server_url", url).apply();
                boolean stored = vault.save(token);
                update(stored ? "Conectado com segurança." : "Conectado. A senha não pôde ser armazenada neste aparelho.");
                if (chat) { append("Você: " + message + "\n\nOpenCode: " + reply); prompt.setText(""); }
            });
        });
    }
    @Override public void onDestroy() { io.shutdownNow(); super.onDestroy(); }
}
