package br.com.w1capital.opencode;

import java.net.URI;
import java.util.Locale;

/** Prevents leaked bearer tokens to HTTP, credentials-in-URL and unexpected paths. */
public final class Endpoint {
    private Endpoint() {}
    public static String normalize(String input) {
        if (input == null) throw new IllegalArgumentException("Informe a URL HTTPS da Cloudflare.");
        final URI url;
        try { url = URI.create(input.trim()); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("URL inválida."); }
        String host = url.getHost();
        if (!"https".equalsIgnoreCase(url.getScheme())
                || host == null || host.isEmpty()
                || "localhost".equalsIgnoreCase(host)
                || host.startsWith("127.")
                || url.getRawUserInfo() != null
                || url.getRawQuery() != null
                || url.getRawFragment() != null
                || (url.getPort() != -1 && url.getPort() != 443)
                || (url.getRawPath() != null && !url.getRawPath().isEmpty() && !"/".equals(url.getRawPath()))) {
            throw new IllegalArgumentException("Use apenas a URL HTTPS base do Worker, sem caminhos ou parâmetros.");
        }
        return "https://" + host.toLowerCase(Locale.ROOT);
    }
}
