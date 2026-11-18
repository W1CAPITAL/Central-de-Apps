package br.com.w1capital.central;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import javax.net.ssl.HttpsURLConnection;

public final class ApkDownloader {
    public interface Progress { void onProgress(int percent); }
    private ApkDownloader() {}

    public static String fetchCatalog() throws Exception {
        URL url=new URL(ReleaseCatalog.API);
        HttpsURLConnection connection=(HttpsURLConnection)url.openConnection();
        connection.setConnectTimeout(12000);connection.setReadTimeout(15000);
        connection.setRequestProperty("Accept","application/vnd.github+json");
        connection.setRequestProperty("User-Agent","W1-Central-Android");
        connection.setInstanceFollowRedirects(false);
        try {
            if(connection.getResponseCode()!=200)throw new IOException("Catálogo GitHub HTTP "+connection.getResponseCode());
            try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int size,n;
                while((n=in.read(buffer))!=-1){
                    size=out.size()+n;
                    if(size>2_000_000)throw new IOException("Catálogo maior que o limite permitido.");
                    out.write(buffer,0,n);
                }
                return out.toString(StandardCharsets.UTF_8.name());
            }
        }finally{connection.disconnect();}
    }

    public static File download(Context context,ReleaseCatalog.ApkRelease asset,Progress progress) throws Exception {
        if(asset==null)throw new IllegalArgumentException("Nenhum APK oficial.");
        String expectedName=ReleaseCatalog.fileName(asset.product,asset.version);
        String expectedUrl="https://github.com/W1CAPITAL/Central-de-Apps/releases/download/"+
            (asset.preview?"android-preview-v":"android-v")+asset.version+"/"+expectedName;
        if(!expectedName.equals(asset.name)||!expectedUrl.equals(asset.url)||asset.size<100_000 ||
            asset.size>ReleaseCatalog.MAX_APK_SIZE||!asset.sha256.matches("[a-f0-9]{64}"))
            throw new SecurityException("Manifesto APK não corresponde à publicação oficial.");
        File dir=new File(context.getFilesDir(),"verified-apks");
        if(!dir.exists()&&!dir.mkdirs())throw new IOException("Não foi possível preparar a pasta de APKs.");
        File output=new File(dir,expectedName);
        if(output.isFile() && output.length()==asset.size && asset.sha256.equals(sha256(output))){
            progress.onProgress(100);return output;
        }
        File temp=new File(dir,expectedName+".part");
        if(temp.exists()&&!temp.delete())throw new IOException("Arquivo temporário bloqueado.");
        HttpsURLConnection connection=null;
        try {
            URL current=new URL(expectedUrl);
            for(int redirect=0;redirect<6;redirect++){
                if(!allowed(current))throw new SecurityException("Endereço do download não é oficial.");
                connection=(HttpsURLConnection)current.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(35000);
                connection.setRequestProperty("User-Agent","W1-Central-Android");
                connection.setRequestProperty("Accept","application/octet-stream");
                int code=connection.getResponseCode();
                if(code==301||code==302||code==303||code==307||code==308){
                    String location=connection.getHeaderField("Location");
                    if(location==null)throw new IOException("Redirecionamento do GitHub sem destino.");
                    URL next=new URL(current,location);
                    connection.disconnect();connection=null;current=next;continue;
                }
                if(code!=200)throw new IOException("Download GitHub HTTP "+code);
                long length=connection.getContentLengthLong();
                if(length>=0 && length!=asset.size)throw new SecurityException("Tamanho do APK diferente do catálogo.");
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                long received=0;
                try(InputStream input=new BufferedInputStream(connection.getInputStream());
                    OutputStream stream=new BufferedOutputStream(new FileOutputStream(temp))){
                    byte[] buffer=new byte[32768];int n;
                    while((n=input.read(buffer))!=-1){
                        if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Download interrompido.");
                        received+=n;
                        if(received>asset.size)throw new SecurityException("APK excedeu o tamanho autorizado.");
                        digest.update(buffer,0,n);stream.write(buffer,0,n);
                        progress.onProgress((int)Math.min(99,(received*100L)/asset.size));
                    }
                }
                if(received!=asset.size)throw new SecurityException("APK incompleto.");
                String hash=toHex(digest.digest());
                if(!asset.sha256.equals(hash))throw new SecurityException("SHA-256 do APK divergente.");
                if(output.exists()&&!output.delete())throw new IOException("APK antigo bloqueado.");
                if(!temp.renameTo(output))throw new IOException("Falha ao concluir arquivo verificado.");
                progress.onProgress(100);
                return output;
            }
            throw new SecurityException("Excesso de redirecionamentos no download.");
        }finally {
            if(connection!=null)connection.disconnect();
            if(temp.exists())temp.delete();
        }
    }

    private static boolean allowed(URL url) {
        if(!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo()!=null ||
           (url.getPort()!=-1 && url.getPort()!=443))return false;
        String host=url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("github.com")||host.equals("release-assets.githubusercontent.com")||
               host.equals("objects.githubusercontent.com");
    }

    private static String toHex(byte[] bytes) {
        char[] hex=new char[bytes.length*2];char[] digits="0123456789abcdef".toCharArray();
        for(int i=0;i<bytes.length;i++){
            hex[i*2]=digits[(bytes[i]>>>4)&15];hex[i*2+1]=digits[bytes[i]&15];
        }
        return new String(hex);
    }
    private static String sha256(File file) throws Exception{
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(file)){
            byte[] buffer=new byte[32768];int n;
            while((n=in.read(buffer))!=-1)digest.update(buffer,0,n);
        }
        return toHex(digest.digest());
    }
}
