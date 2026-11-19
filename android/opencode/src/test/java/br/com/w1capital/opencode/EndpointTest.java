package br.com.w1capital.opencode;

import org.junit.Test;
import static org.junit.Assert.*;

public class EndpointTest {
    @Test public void normalizesValidSecureWorkerOrigin() {
        assertEquals("https://w1-opencode-mobile.example.workers.dev",
                Endpoint.normalize(" https://W1-OPENCODE-MOBILE.example.workers.dev/ "));
    }
    @Test public void blocksInsecureAndUnintendedOrigins() {
        for (String address : new String[]{
                "http://example.workers.dev", "https://localhost",
                "https://127.0.0.1:9999", "https://user:pass@example.com",
                "https://example.com/api/chat", "https://example.com?token=x",
                "https://example.com:8443", "file:///etc/passwd", ""
        }) {
            try { Endpoint.normalize(address); fail("Must reject: " + address); }
            catch (IllegalArgumentException expected) {}
        }
    }
}
