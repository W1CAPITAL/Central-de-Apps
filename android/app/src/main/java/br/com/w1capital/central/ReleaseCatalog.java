package br.com.w1capital.central;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Accepts only release assets with a matching tag, exact W1 repository URL,
 * SHA-256 published by GitHub, a bounded file size and an Android .apk suffix.
 * Windows installers are intentionally never offered for Android.
 */
public final class ReleaseCatalog {
    private ReleaseCatalog() {}

    public static final String API =
        "https://api.github.com/repos/W1CAPITAL/Central-de-Apps/releases?per_page=80";
    private static final String ORIGIN =
        "https://github.com/W1CAPITAL/Central-de-Apps/releases/download/";
    private static final Pattern VERSION = Pattern.compile("[0-9]{1,4}\\.[0-9]{1,4}\\.[0-9]{1,6}");
    private static final Pattern HASH = Pattern.compile("sha256:[a-fA-F0-9]{64}");
    private static final Pattern TAG = Pattern.compile("android-(?:preview-)?v" + VERSION.pattern());
    public static final int MAX_APK_SIZE = 250 * 1024 * 1024;
    private static final Map<String,String> PREFIX;
    static {
        Map<String,String> map = new HashMap<>();
        map.put("central","W1-Central-de-Apps");
        map.put("lexispredict","LexisPredict");
        map.put("infinitum","INFINITUM");
        map.put("predictbot","PredictBot");
        PREFIX = Collections.unmodifiableMap(map);
    }

    public static String fileName(String id,String version) {
        if (!PREFIX.containsKey(id) || version == null || !VERSION.matcher(version).matches())
            throw new IllegalArgumentException("Produto ou versão Android inválida.");
        return PREFIX.get(id) + "-Android-" + version + ".apk";
    }

    public static final class ApkRelease {
        public final String product, version, url, sha256, name;
        public final long size;
        public final boolean preview;
        public ApkRelease(String product,String version,String name,String url,String sha256,long size,boolean preview) {
            this.product=product;this.version=version;this.name=name;this.url=url;
            this.sha256=sha256;this.size=size;this.preview=preview;
        }
    }

    public static Map<String,ApkRelease> parse(String json) throws Exception {
        JSONArray releases = new JSONArray(json);
        if (releases.length()>80) throw new IllegalArgumentException("Catálogo maior que o permitido.");
        Map<String,ApkRelease> found = new HashMap<>();
        for(int i=0;i<releases.length();i++){
            JSONObject release=releases.optJSONObject(i);
            if(release==null || release.optBoolean("draft",true))continue;
            String tag=release.optString("tag_name","");
            if(!TAG.matcher(tag).matches())continue;
            boolean preview=tag.startsWith("android-preview-v");
            if (preview != release.optBoolean("prerelease",false)) continue;
            String version=tag.substring(preview?"android-preview-v".length():"android-v".length());
            JSONArray assets=release.optJSONArray("assets");
            if(assets==null)continue;
            for(int k=0;k<assets.length();k++){
                JSONObject asset=assets.optJSONObject(k);
                if(asset==null)continue;
                for(String id:PREFIX.keySet()){
                    String filename=fileName(id,version);
                    String url=ORIGIN+tag+"/"+filename;
                    long size=asset.optLong("size",-1);
                    String hash=asset.optString("digest","");
                    if(!filename.equals(asset.optString("name")) ||
                       !url.equals(asset.optString("browser_download_url")) ||
                       size<100_000 || size>MAX_APK_SIZE ||
                       !HASH.matcher(hash).matches())continue;
                    ApkRelease candidate = new ApkRelease(id,version,filename,url,hash.substring(7).toLowerCase(java.util.Locale.ROOT),size,preview);
                    ApkRelease old = found.get(id);
                    if(old==null || compareVersions(candidate.version,old.version)>0 ||
                        (compareVersions(candidate.version,old.version)==0 && !candidate.preview && old.preview)){
                        found.put(id,candidate);
                    }
                }
            }
        }
        return found;
    }

    public static int compareVersions(String a,String b){
        if(!VERSION.matcher(a).matches() || !VERSION.matcher(b).matches())return 0;
        String[] x=a.split("\\."),y=b.split("\\.");
        for(int i=0;i<3;i++){
            int n=Integer.parseInt(x[i])-Integer.parseInt(y[i]);
            if(n!=0)return Integer.signum(n);
        }
        return 0;
    }
}
