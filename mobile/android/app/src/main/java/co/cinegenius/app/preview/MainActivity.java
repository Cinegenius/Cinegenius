package co.cinegenius.app.preview;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String presentationScript;
    private String resumeScript;
    private boolean presentationAtDocumentStart;
    private boolean wasInBackground;

    @Override
    protected void load() {
        // BridgeActivity has inflated the WebView, but Capacitor has not loaded
        // its first document yet. Install here to avoid a download-ad flash.
        if (config == null) config = CapConfig.loadDefault(this);
        presentationScript = bundledScript("app-presentation.js");
        resumeScript = bundledScript("app-resume.js");
        WebView view = findViewById(com.getcapacitor.android.R.id.webview);
        String origin = AppWebOrigin.configured(config.getServerUrl());
        if (view != null && origin != null && presentationScript != null
            && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(view, presentationScript, Collections.singleton(origin));
                presentationAtDocumentStart = true;
            } catch (IllegalArgumentException | UnsupportedOperationException ignored) {
                // Older/inconsistent WebView providers use the guarded callback.
            }
        }
        super.load();
    }

    private String bundledScript(String name) {
        try (InputStream input = getAssets().open("public/" + name);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int count; (count = input.read(buffer)) != -1;) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        } catch (java.io.IOException ignored) { return null; }
    }

    private void applyPresentation(WebView view) {
        if (!presentationAtDocumentStart && presentationScript != null && getBridge() != null
            && AppWebOrigin.matches(getBridge().getServerUrl(), view.getUrl())) {
            view.evaluateJavascript(presentationScript, null);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                applyPresentation(view);
            }

            @Override
            public void onPageLoaded(WebView view) {
                applyPresentation(view);
                if (getBridge() == null || !getBridge().getErrorUrl().equals(view.getUrl())) return;
                String cookies = CookieManager.getInstance().getCookie(getBridge().getServerUrl());
                if (cookies == null) return;
                for (String cookie : cookies.split(";")) {
                    String value = cookie.trim();
                    if (!value.startsWith("cg_locale=")) continue;
                    // No session cookies leave the native cookie store.
                    String locale = JSONObject.quote(value.substring("cg_locale=".length()));
                    view.evaluateJavascript("window.cinegeniusSavedLocale=" + locale
                        + ";window.dispatchEvent(new CustomEvent('cinegenius:locale',{detail:window.cinegeniusSavedLocale}));", null);
                    break;
                }
            }
        });
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    public void onStop() {
        wasInBackground = !isChangingConfigurations();
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!wasInBackground) return;
        wasInBackground = false;
        if (resumeScript != null && getBridge() != null) {
            WebView view = getBridge().getWebView();
            if (AppWebOrigin.matches(getBridge().getServerUrl(), view.getUrl())) {
                view.evaluateJavascript(resumeScript, null);
            }
        }
    }
}
