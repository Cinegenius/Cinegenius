package co.cinegenius.app.preview;

import static org.junit.Assert.*;
import org.junit.Test;

public class AppWebOriginTest {
    @Test public void sameOriginPagesAndDefaultPortsMatch() {
        assertTrue(AppWebOrigin.matches("https://www.cinegenius.co/", "https://www.cinegenius.co/locations?view=list"));
        assertTrue(AppWebOrigin.matches("https://www.cinegenius.co:443/", "https://www.cinegenius.co/news"));
        assertTrue(AppWebOrigin.matches("http://10.0.2.2:3010/", "http://10.0.2.2:3010/sign-in"));
    }
    @Test public void rejectUntrustedNavigation() {
        for (String url : new String[]{"https://www.cinegenius.co.evil.example/", "http://www.cinegenius.co/",
            "https://www.cinegenius.co:8443/", "https://user@www.cinegenius.co/", "https://clerk.cinegenius.co/",
            "file:///index.html", "about:blank", null}) {
            assertFalse(String.valueOf(url), AppWebOrigin.matches("https://www.cinegenius.co/", url));
        }
        assertFalse(AppWebOrigin.matches("http://localhost:3010/", "http://localhost:3011/"));
    }
    @Test public void rejectInvalidPreviewConfiguration() {
        for (String url : new String[]{"https://other.example/", "https://www.cinegenius.co/sign-in",
            "https://www.cinegenius.co/?token=x", "https://user@www.cinegenius.co/",
            "http://localhost", "http://192.168.1.2:3010", "broken", null}) assertNull(String.valueOf(url), AppWebOrigin.configured(url));
    }
}
