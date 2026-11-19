package br.com.w1capital.opencode;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Credenciais de sessão são criptografadas pelo Android Keystore, nunca embutidas no APK. */
public final class CredentialVault {
    private static final String ALIAS = "w1_opencode_mobile_aes";
    private final SharedPreferences preferences;
    public CredentialVault(Context context) {
        preferences = context.getSharedPreferences("w1_opencode_secret", Context.MODE_PRIVATE);
    }
    private SecretKey getKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }
    public boolean save(String token) {
        if (token == null || token.isEmpty()) return false;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getKey());
            byte[] cipherText = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            return preferences.edit()
                    .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .putString("token", Base64.encodeToString(cipherText, Base64.NO_WRAP))
                    .commit();
        } catch (Exception ignored) { return false; }
    }
    public String load() {
        String iv = preferences.getString("iv", null);
        String data = preferences.getString("token", null);
        if (iv == null || data == null) return "";
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getKey(),
                    new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT)));
            return new String(cipher.doFinal(Base64.decode(data, Base64.DEFAULT)), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            clear();
            return "";
        }
    }
    public void clear() {
        preferences.edit().remove("iv").remove("token").commit();
    }
}
