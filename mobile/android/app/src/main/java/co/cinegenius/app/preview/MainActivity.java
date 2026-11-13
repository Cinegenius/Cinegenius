package co.cinegenius.app.preview;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
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
}
