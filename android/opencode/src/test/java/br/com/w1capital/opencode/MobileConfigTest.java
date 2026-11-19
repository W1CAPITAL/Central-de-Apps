package br.com.w1capital.opencode;

import org.junit.Test;
import static org.junit.Assert.*;

public class MobileConfigTest {
    @Test public void noSetupOrComputerRequiredForClientEndpoints() {
        assertEquals(MobileConfig.CLOUD, Endpoint.normalize(MobileConfig.CLOUD));
        assertEquals(MobileConfig.AUTH, Endpoint.normalize(MobileConfig.AUTH));
        assertFalse(MobileConfig.CLOUD.contains("localhost"));
        assertFalse(MobileConfig.CLOUD.contains("127.0.0.1"));
        assertTrue(MobileConfig.PUBLISHABLE_KEY.startsWith("sb_publishable_"));
    }
    @Test public void doesNotShipAdministrativeApiKeys() {
        assertFalse(MobileConfig.PUBLISHABLE_KEY.startsWith("sb_secret_"));
        assertFalse(MobileConfig.PUBLISHABLE_KEY.startsWith("service_role"));
    }
}
