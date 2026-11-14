package co.cinegenius.app.preview;

import java.net.URI;

/** Exact development origins; never allow wildcard domains or credentials. */
final class AppWebOrigin {
    static String configured(String value) {
        try {
            URI url = new URI(value);
            if (url.getRawQuery() != null || url.getRawFragment() != null
                || !(url.getRawPath().isEmpty() || "/".equals(url.getRawPath()))) return null;
            String origin = canonical(url);
            if ("https://www.cinegenius.co".equals(origin)) return origin;
            if ("http".equals(url.getScheme()) && url.getPort() >= 0
                && ("localhost".equals(url.getHost()) || "127.0.0.1".equals(url.getHost()) || "10.0.2.2".equals(url.getHost()))) return origin;
        } catch (Exception ignored) { }
        return null;
    }

    static boolean matches(String configuredURL, String currentURL) {
        String expected = configured(configuredURL);
        try { return expected != null && expected.equals(canonical(new URI(currentURL))); }
        catch (Exception ignored) { return false; }
    }

    private static String canonical(URI url) {
        if (url.getUserInfo() != null || url.getHost() == null) return null;
        String scheme = url.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme)) return null;
        int port = url.getPort();
        boolean defaultPort = port == -1 || ("https".equals(scheme) && port == 443) || ("http".equals(scheme) && port == 80);
        return scheme + "://" + url.getHost() + (defaultPort ? "" : ":" + port);
    }
}
