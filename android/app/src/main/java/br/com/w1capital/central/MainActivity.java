package br.com.w1capital.central;

import android.app.Activity;
import android.content.*;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import java.io.File;
import java.util.*;
import java.util.concurrent.*;

/**
 * A real Android-native storefront. Works without a desktop or Vercel for
 * installed-app launching and offline catalog display; GitHub is only needed
 * to check releases and download verified Android APKs.
 */
public final class MainActivity extends Activity {
    private static final int BACKGROUND=Color.rgb(19,14,19);
    private static final int PANEL=Color.rgb(36,25,33);
    private static final int BORDER=Color.rgb(91,57,72);
    private static final int TEXT=Color.rgb(241,231,235);
    private static final int MUTED=Color.rgb(187,164,176);
    private static final int ACCENT=Color.rgb(140,44,76);
    private static final int SECONDARY=Color.rgb(65,42,54);
    private static final Product[] PRODUCTS={
        new Product("lexispredict","LexisPredict","Gabinete jurídico, processos, prazos e publicações",
            "br.com.w1capital.lexispredict.android","W1CAPITAL/LexisPredict","LP"),
        new Product("infinitum","INFINITUM","CRM, atendimentos, agenda e agentes",
            "br.com.w1capital.infinitum.android","W1CAPITAL/Infinitum","IN"),
        new Product("predictbot","PredictBot","Agentes e integração com OpenCode e MCP",
            "br.com.w1capital.predictbot.android","W1CAPITAL/PredictBot","PB"),
        new Product("central","Central de Apps","Instalação, atualização e organização dos aplicativos W1",
            "br.com.w1capital.central.android","W1CAPITAL/Central-de-Apps","W1")
    };
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final Map<String,ReleaseCatalog.ApkRelease> releases=new HashMap<>();
    private final Map<String,TextView> descriptions=new HashMap<>();
    private final Map<String,Button> actions=new HashMap<>();
    private TextView status; private Button refresh;
    private boolean fetching=false,downloading=false;

    private static final class Product {
        final String id,name,description,packageName,repo,initial;
        Product(String id,String name,String description,String packageName,String repo,String initial){
            this.id=id;this.name=name;this.description=description;this.packageName=packageName;this.repo=repo;this.initial=initial;
        }
    }

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        getWindow().getDecorView().setSystemUiVisibility(0);
        draw();
        String cached=getPreferences(MODE_PRIVATE).getString("release_catalog",null);
        if(cached!=null){try{releases.putAll(ReleaseCatalog.parse(cached));}catch(Exception ignored){}}
        render();
        fetchReleases();
    }
    private int dp(float value){return (int)(getResources().getDisplayMetrics().density*value+0.5f);}
    private GradientDrawable background(int color,int radius,int stroke){
        GradientDrawable drawable=new GradientDrawable();drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        if(stroke!=0)drawable.setStroke(dp(1),stroke);
        return drawable;
    }
    private TextView text(String value,int size,int color,boolean bold){
        TextView view=new TextView(this);view.setText(value);view.setTextSize(size);view.setTextColor(color);
        if(bold)view.setTypeface(Typeface.create("sans-serif-medium",Typeface.BOLD));
        view.setLineSpacing(dp(3),1.0f);
        return view;
    }
    private Button button(String label,boolean accent){
        Button view=new Button(this);view.setText(label);view.setAllCaps(false);
        view.setTextColor(TEXT);view.setTextSize(13);
        view.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
        view.setBackground(background(accent?ACCENT:SECONDARY,12,accent?0:BORDER));
        view.setMinHeight(dp(45));view.setPadding(dp(12),0,dp(12),0);
        return view;
    }
    private LinearLayout vertical(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private void gap(LinearLayout v,int height){Space space=new Space(this);v.addView(space,new LinearLayout.LayoutParams(1,dp(height)));}
    private LinearLayout.LayoutParams full(){return new LinearLayout.LayoutParams(-1,-2);}
    private LinearLayout.LayoutParams weighted(){return new LinearLayout.LayoutParams(0,-2,1);}
    private void draw(){
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(BACKGROUND);
        LinearLayout root=vertical();root.setPadding(dp(20),dp(32),dp(20),dp(32));scroll.addView(root);
        LinearLayout brand=new LinearLayout(this);brand.setGravity(Gravity.CENTER_VERTICAL);
        TextView mark=text("W1",20,TEXT,true);mark.setGravity(Gravity.CENTER);
        mark.setBackground(background(ACCENT,14,0));brand.addView(mark,new LinearLayout.LayoutParams(dp(54),dp(54)));
        LinearLayout heading=vertical();heading.setPadding(dp(14),0,0,0);
        heading.addView(text("W1 CAPITAL",12,MUTED,true));heading.addView(text("Central de Apps",26,TEXT,true));
        brand.addView(heading,weighted());root.addView(brand);
        gap(root,22);
        TextView headline=text("Seu ecossistema W1 no Android",17,TEXT,true);root.addView(headline);
        gap(root,6);
        root.addView(text("Instale e abra aplicativos Android oficiais. A Central funciona sem servidor próprio; apenas a consulta de novas versões precisa de internet.",13,MUTED,false));
        gap(root,20);
        LinearLayout actionsRow=new LinearLayout(this);actionsRow.setOrientation(LinearLayout.HORIZONTAL);
        refresh=button("Verificar atualizações",true);actionsRow.addView(refresh,weighted());
        refresh.setOnClickListener(v->fetchReleases());
        gap(root,9);
        status=text("Catálogo local disponível.",12,MUTED,false);
        root.addView(actionsRow);root.addView(status);
        gap(root,22);
        TextView section=text("APLICATIVOS",12,MUTED,true);root.addView(section);gap(root,10);
        for(Product product:PRODUCTS){
            LinearLayout card=vertical();card.setPadding(dp(16),dp(16),dp(16),dp(16));
            card.setBackground(background(PANEL,18,BORDER));
            LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);
            TextView icon=text(product.initial,16,TEXT,true);icon.setGravity(Gravity.CENTER);
            icon.setBackground(background(SECONDARY,12,0));
            header.addView(icon,new LinearLayout.LayoutParams(dp(45),dp(45)));
            LinearLayout titleArea=vertical();titleArea.setPadding(dp(12),0,0,0);
            titleArea.addView(text(product.name,18,TEXT,true));
            titleArea.addView(text(product.description,12,MUTED,false));
            header.addView(titleArea,weighted());card.addView(header);gap(card,12);
            TextView state=text("Verificando disponibilidade Android...",12,MUTED,false);
            descriptions.put(product.id,state);card.addView(state);gap(card,10);
            LinearLayout buttons=new LinearLayout(this);
            Button main=button("Verificar",true);
            actions.put(product.id,main);buttons.addView(main,weighted());
            Space inset=new Space(this);buttons.addView(inset,new LinearLayout.LayoutParams(dp(10),1));
            Button source=button("GitHub",false);buttons.addView(source,new LinearLayout.LayoutParams(dp(100),-2));
            main.setOnClickListener(v->handleProduct(product));
            source.setOnClickListener(v->openLink("https://github.com/"+product.repo));
            card.addView(buttons);root.addView(card);gap(root,12);
        }
        gap(root,10);
        LinearLayout notice=vertical();notice.setPadding(dp(16),dp(16),dp(16),dp(16));
        notice.setBackground(background(SECONDARY,16,BORDER));
        notice.addView(text("IA local no celular",15,TEXT,true));
        gap(notice,6);
        notice.addView(text("O BitNet configurado no Windows não roda automaticamente neste APK. A Central Android não usa créditos de IA nem executa modelos na nuvem. Uma versão Android de inferência precisa de motor nativo e validação de memória próprios.",12,MUTED,false));
        root.addView(notice);
        gap(root,20);
        root.addView(text("W1 CAPITAL  •  Android nativo  •  Downloads oficiais verificados",11,MUTED,false));
        setContentView(scroll);
    }

    private void fetchReleases(){
        if(fetching || downloading)return;
        fetching=true;refresh.setEnabled(false);status.setText("Consultando releases oficiais do GitHub...");
        executor.execute(()->{
            try{
                String data=ApkDownloader.fetchCatalog();
                Map<String,ReleaseCatalog.ApkRelease> parsed=ReleaseCatalog.parse(data);
                getPreferences(MODE_PRIVATE).edit().putString("release_catalog",data).apply();
                handler.post(()->{
                    releases.clear();releases.putAll(parsed);fetching=false;refresh.setEnabled(true);
                    status.setText("Catálogo atualizado. Instalações exigem confirmação do Android.");render();
                });
            }catch(Exception error){
                handler.post(()->{
                    fetching=false;refresh.setEnabled(true);
                    status.setText("Consulta indisponível. "+(releases.isEmpty()?"Sem APKs em cache.":"Usando catálogo em cache."));
                    render();
                });
            }
        });
    }

    private boolean installed(Product product){
        if(product.id.equals("central"))return true;
        try{getPackageManager().getPackageInfo(product.packageName,0);return true;}
        catch(Exception notInstalled){return false;}
    }
    private String installedVersion(Product product){
        try{
            PackageInfo info=getPackageManager().getPackageInfo(product.packageName,0);
            return info.versionName==null?"0.0.0":info.versionName;
        }catch(Exception unavailable){return "0.0.0";}
    }
    private void render(){
        for(Product product:PRODUCTS){
            TextView description=descriptions.get(product.id);Button action=actions.get(product.id);
            boolean hasApp=installed(product);
            ReleaseCatalog.ApkRelease release=releases.get(product.id);
            if(release==null){
                description.setText(hasApp?"Instalado · nenhuma versão Android mais recente disponível.":"APK Android ainda não publicado. Windows (.exe) não é compatível.");
                action.setText(hasApp?"Abrir aplicativo":"Indisponível");
                action.setEnabled(hasApp&&!product.id.equals("central"));
            }else{
                String version=hasApp?installedVersion(product):"Não instalado";
                boolean newer=!hasApp||ReleaseCatalog.compareVersions(release.version,version)>0;
                description.setText("Instalado: "+version+"  ·  Disponível: "+release.version+(release.preview?" (teste)":""));
                action.setText(newer?(hasApp?"Atualizar APK":"Baixar APK"):(product.id.equals("central")?"Versão instalada":"Abrir aplicativo"));
                action.setEnabled(!downloading && (newer||!product.id.equals("central")));
            }
        }
    }

    private void handleProduct(Product product){
        if(downloading)return;
        ReleaseCatalog.ApkRelease release=releases.get(product.id);
        boolean hasApp=installed(product);
        if(release==null || (hasApp && ReleaseCatalog.compareVersions(release.version,installedVersion(product))<=0)){
            if(hasApp&&!product.id.equals("central"))launchApp(product);
            return;
        }
        downloading=true;render();
        TextView description=descriptions.get(product.id);
        description.setText("Iniciando download oficial...");
        executor.execute(()->{
            try{
                File apk=ApkDownloader.download(this,release,p->handler.post(()->description.setText(
                    "Baixando "+release.name+" · "+p+"%")));
                handler.post(()->{downloading=false;render();install(apk);});
            }catch(Exception error){
                handler.post(()->{
                    downloading=false;render();
                    status.setText("Não foi possível instalar: "+String.valueOf(error.getMessage()));
                });
            }
        });
    }
    private void install(File apk){
        if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){
            status.setText("Autorize a instalação de APKs desta Central nas configurações e toque em Atualizar novamente.");
            try{startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:"+getPackageName())));}
            catch(Exception e){status.setText("Autorize esta Central a instalar aplicativos nas configurações do Android.");}
            return;
        }
        try{
            Uri uri=new Uri.Builder().scheme("content")
                .authority(getPackageName()+".apks").appendPath(apk.getName()).build();
            Intent intent=new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri,"application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
            status.setText("Confirme a instalação na tela do Android.");
        }catch(Exception error){status.setText("O instalador do Android não pôde abrir o APK.");}
    }
    private void launchApp(Product product){
        Intent intent=getPackageManager().getLaunchIntentForPackage(product.packageName);
        if(intent==null){status.setText("O aplicativo Android não possui uma atividade de abertura.");return;}
        try{startActivity(intent);}catch(Exception e){status.setText("Não foi possível abrir o aplicativo instalado.");}
    }
    private void openLink(String uri){
        try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(uri)));}
        catch(Exception e){status.setText("Nenhum navegador disponível neste aparelho.");}
    }
    @Override public void onResume(){super.onResume();if(status!=null)render();}
    @Override public void onDestroy(){executor.shutdownNow();super.onDestroy();}
}
