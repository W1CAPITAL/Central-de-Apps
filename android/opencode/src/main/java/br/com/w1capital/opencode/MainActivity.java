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
import android.widget.ImageView;
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

/** Cliente nativo W1: conexão da nuvem pré-configurada, autenticação individual. */
public final class MainActivity extends Activity {
    private static final int BACKGROUND = Color.rgb(20,15,21);
    private static final int PANEL = Color.rgb(39,28,38);
    private static final int TEXT = Color.rgb(248,237,240);
    private static final int MUTED = Color.rgb(194,171,183);
    private static final int WINE = Color.rgb(142,44,79);
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private EditText email, password, prompt;
    private Button connect, send, logout;
    private TextView status, transcript;
    private ScrollView scroll;
    private CredentialVault vault;
    private boolean busy;
    private String temporaryAccessToken = "";

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private GradientDrawable panel(int color) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color); shape.setCornerRadius(dp(16)); return shape;
    }
    private TextView text(String value, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }
    private EditText entry(String hint, int inputType, boolean multiline) {
        EditText e = new EditText(this);
        e.setTextColor(TEXT); e.setHintTextColor(MUTED); e.setTextSize(15);
        e.setHint(hint); e.setInputType(inputType);
        e.setSingleLine(!multiline);
        if (multiline) { e.setMinLines(3); e.setGravity(Gravity.TOP); }
        e.setPadding(dp(14),dp(12),dp(14),dp(12));
        e.setBackground(panel(PANEL));
        return e;
    }
    private Button action(String value) {
        Button b = new Button(this);
        b.setAllCaps(false); b.setText(value); b.setTextColor(TEXT);
        b.setBackgroundTintList(ColorStateList.valueOf(WINE));
        b.setMinHeight(dp(48)); return b;
    }
    private void add(LinearLayout root, View view, int gap) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2);
        p.bottomMargin=dp(gap); root.addView(view,p);
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        vault = new CredentialVault(this);
        scroll = new ScrollView(this);
        scroll.setFillViewport(true); scroll.setBackgroundColor(BACKGROUND);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20),dp(22),dp(20),dp(30)); scroll.addView(content);
        ImageView brand = new ImageView(this);
        brand.setImageResource(R.drawable.w1_opencode_icon);
        brand.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams img = new LinearLayout.LayoutParams(dp(92),dp(92));
        img.bottomMargin=dp(10); content.addView(brand,img);
        add(content,text("W1 CAPITAL",12,MUTED,true),6);
        add(content,text("OpenCode Mobile",27,TEXT,true),8);
        add(content,text("Pronto para usar pelo celular. Sem PC, QR Code ou endereço de servidor.",14,MUTED,false),22);

        add(content,text("ENTRAR NA CONTA W1",12,MUTED,true),8);
        email=entry("Seu e-mail",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,false);
        email.setText(getPreferences(MODE_PRIVATE).getString("email",""));
        add(content,email,10);
        password=entry("Sua senha",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD,false);
        add(content,password,10);
        connect=action("Entrar e conectar"); add(content,connect,8);
        status=text("Entre com sua conta W1 para começar.",13,MUTED,false);
        add(content,status,18);
        logout=action("Sair desta conta"); add(content,logout,22);

        add(content,text("CONVERSA",12,MUTED,true),10);
        transcript=text("Diga o que deseja fazer. O OpenCode roda na nuvem W1.",15,TEXT,false);
        transcript.setTextIsSelectable(true);
        transcript.setPadding(dp(14),dp(14),dp(14),dp(14));
        transcript.setBackground(panel(PANEL));
        add(content,transcript,14);
        prompt=entry("Escreva sua solicitação...",InputType.TYPE_CLASS_TEXT|
                InputType.TYPE_TEXT_FLAG_MULTI_LINE|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES,true);
        add(content,prompt,10);
        send=action("Enviar mensagem"); add(content,send,12);
        add(content,text("A IA exige internet e está sujeita às cotas da Cloudflare. O acesso aos arquivos do telefone ou a repositórios não é automático.",12,MUTED,false),0);

        setContentView(scroll);
        connect.setOnClickListener(v->request(false));
        send.setOnClickListener(v->request(true));
        logout.setOnClickListener(v-> {
            vault.clear(); temporaryAccessToken="";
            password.setText(""); status.setText("Sessão encerrada neste aparelho.");
        });
        if (!vault.load().isEmpty()) request(false);
    }
    private void toggle(boolean loading) {
        busy=loading; connect.setEnabled(!loading); send.setEnabled(!loading); logout.setEnabled(!loading);
    }
    private void append(String value) {
        String current=transcript.getText().toString();
        String merged=current+"\n\n"+value;
        if (merged.length()>30000) merged=merged.substring(merged.length()-30000);
        transcript.setText(merged);
        scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));
    }
    private static String read(InputStream in) throws Exception {
        if (in==null) return "";
        try (InputStream stream=in; ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[4096]; int n;
            while ((n=stream.read(buffer))!=-1) {
                if (bytes.size()+n>1024*1024) throw new IllegalStateException("Resposta do servidor muito grande.");
                bytes.write(buffer,0,n);
            }
            return bytes.toString("UTF-8");
        }
    }
    private static JSONObject call(String address, String method, JSONObject payload, String authorization, String apikey, int timeout) throws Exception {
        HttpURLConnection conn=null;
        try {
            URL endpoint=new URL(address);
            if (!"https".equalsIgnoreCase(endpoint.getProtocol())) throw new IllegalArgumentException("Conexão insegura.");
            conn=(HttpURLConnection)endpoint.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(15000); conn.setReadTimeout(timeout);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept","application/json");
            if (authorization!=null) conn.setRequestProperty("Authorization","Bearer "+authorization);
            if (apikey!=null) conn.setRequestProperty("apikey",apikey);
            if (payload!=null) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type","application/json; charset=utf-8");
                byte[] json=payload.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(json.length);
                try(OutputStream out=conn.getOutputStream()){out.write(json);}
            }
            int status=conn.getResponseCode();
            String data=read(status>=400?conn.getErrorStream():conn.getInputStream());
            JSONObject result;
            try {result=new JSONObject(data);} catch(Exception ignored) {throw new IllegalStateException("Resposta inválida do servidor.");}
            if(status<200||status>=300) {
                if(status==400||status==401) throw new IllegalStateException(apikey!=null?
                    "E-mail ou senha inválidos ou sessão expirada.":"A sessão expirou. Entre novamente.");
                if(status==429) throw new IllegalStateException("Limite temporário atingido. Tente mais tarde.");
                throw new IllegalStateException(result.optString("error","Servidor indisponível (HTTP "+status+")."));
            }
            return result;
        } finally { if(conn!=null) conn.disconnect(); }
    }
    private JSONObject credentials(String userEmail, String userPassword) throws Exception {
        String saved=vault.load();
        if(!userEmail.isEmpty()&&!userPassword.isEmpty()) {
            return call(MobileConfig.AUTH+"/auth/v1/token?grant_type=password","POST",
                new JSONObject().put("email",userEmail).put("password",userPassword),null,
                MobileConfig.PUBLISHABLE_KEY,30000);
        }
        if(!saved.isEmpty()) {
            try {
                return call(MobileConfig.AUTH+"/auth/v1/token?grant_type=refresh_token","POST",
                    new JSONObject().put("refresh_token",saved),null,MobileConfig.PUBLISHABLE_KEY,30000);
            } catch(Exception failure) {
                vault.clear();
                throw new IllegalStateException("Sua sessão expirou. Entre com e-mail e senha novamente.");
            }
        }
        return null;
    }
    private void request(boolean chat) {
        if(busy) return;
        final String userEmail=email.getText().toString().trim();
        final String userPassword=password.getText().toString();
        final String message=prompt.getText().toString().trim();
        if(chat&&(message.isEmpty()||message.length()>12000)) {
            status.setText("Escreva uma mensagem com até 12.000 caracteres."); return;
        }
        if(vault.load().isEmpty()&&temporaryAccessToken.isEmpty()&&
            (!userEmail.contains("@")||userPassword.isEmpty())) {
            status.setText("Entre com seu e-mail e sua senha W1."); return;
        }
        toggle(true);
        status.setText(chat?"Enviando ao OpenCode...":"Conectando automaticamente...");
        io.execute(()->{
            String result=null,error=null;
            boolean stored=true,authenticated=false;
            try {
                JSONObject credentials=credentials(userEmail,userPassword);
                String token=credentials==null?temporaryAccessToken:credentials.optString("access_token","");
                if(token.isEmpty())throw new IllegalStateException("Não foi possível autenticar. Entre novamente.");
                if(credentials!=null) {
                    temporaryAccessToken=token;
                    String refresh=credentials.optString("refresh_token","");
                    stored=!refresh.isEmpty()&&vault.save(refresh);
                    authenticated=true;
                }
                JSONObject answer=call(MobileConfig.CLOUD+(chat?"/api/chat":"/api/health"),
                    chat?"POST":"GET",chat?new JSONObject().put("prompt",message):null,
                    token,null,chat?120000:20000);
                if(chat) {
                    if(!"done".equals(answer.optString("status")))
                        throw new IllegalStateException(answer.optString("reason","A IA não concluiu a solicitação."));
                    result=answer.optString("text","Concluído, sem resposta em texto.");
                } else if(!answer.optBoolean("ok",false)) {
                    throw new IllegalStateException("O OpenCode não confirmou a conexão.");
                } else result="Conectado ao OpenCode pelo celular.";
            } catch(Exception ex) {
                error=ex.getMessage()==null?"Verifique sua conexão com a internet.":ex.getMessage();
            }
            final String reply=result, failure=error;
            final boolean refreshStored=stored, loginOk=authenticated;
            main.post(()->{
                toggle(false);
                if(loginOk) {
                    password.setText("");
                    if(!userEmail.isEmpty()) getPreferences(MODE_PRIVATE).edit().putString("email",userEmail).apply();
                }
                if(failure!=null) {status.setText("Não foi possível conectar: "+failure);return;}
                status.setText(refreshStored?"Conectado com segurança.":"Conectado. Seu celular não conseguiu salvar a sessão.");
                if(chat) {
                    append("Você: "+message+"\n\nOpenCode: "+reply);
                    prompt.setText("");
                }
            });
        });
    }
    @Override public void onDestroy() { io.shutdownNow(); super.onDestroy(); }
}
