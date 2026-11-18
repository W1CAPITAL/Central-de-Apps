package br.com.w1capital.central;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/**
 * Non-exported provider. Only Android's user-approved install intent receives
 * temporary read access to a SHA-256-checked APK stored in private app storage.
 */
public final class VerifiedApkProvider extends ContentProvider {
    @Override public boolean onCreate(){return true;}
    private File resolve(Uri uri) throws FileNotFoundException {
        String name=uri.getLastPathSegment();
        if(name==null || !name.matches("(W1-Central-de-Apps|LexisPredict|INFINITUM|PredictBot)-Android-[0-9.]+\\.apk"))
            throw new FileNotFoundException("APK inválido.");
        File dir=new File(getContext().getFilesDir(),"verified-apks");
        File file=new File(dir,name);
        try{
            String base=dir.getCanonicalPath()+File.separator;
            if(!file.getCanonicalPath().startsWith(base)||!file.isFile())throw new FileNotFoundException(name);
        }catch(java.io.IOException e){throw new FileNotFoundException(e.getMessage());}
        return file;
    }
    @Override public String getType(Uri uri){return "application/vnd.android.package-archive";}
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException{
        if(!"r".equals(mode))throw new FileNotFoundException("Somente leitura.");
        return ParcelFileDescriptor.open(resolve(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){
        try{
            File file=resolve(uri);
            MatrixCursor cursor=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});
            cursor.addRow(new Object[]{file.getName(),file.length()});return cursor;
        }catch(Exception e){return null;}
    }
    @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
    @Override public int delete(Uri uri,String selection,String[] args){throw new UnsupportedOperationException();}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] args){throw new UnsupportedOperationException();}
}
