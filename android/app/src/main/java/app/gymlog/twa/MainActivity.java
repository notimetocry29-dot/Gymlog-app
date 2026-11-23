package app.gymlog.twa;

import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** غلاف جيم لوج: بيفتح نفس صفحة GitHub Pages (نفس الـ origin عشان البيانات تفضل) مع ربط أصلي للحفظ والنسخ والرجوع. */
public class MainActivity extends ComponentActivity {
    static final String HOST = "notimetocry29-dot.github.io";
    static final String PATH = "/Gymlog-app";
    static final String URL = "https://" + HOST + PATH + "/";
    static final int DARK = Color.parseColor("#0e0e0f"), LIGHT = Color.parseColor("#f3eee5");
    static final int MAX_FILE = 20 * 1024 * 1024;

    private WebView web;
    private FrameLayout root;
    private SharedPreferences prefs;
    private volatile boolean trusted = false;   // الصفحة الحالية من الـ origin بتاعنا؟ (الـ bridge بيشتغل معاها بس)
    private boolean pageDone = false, onAppPage = false;
    private boolean dark = true;

    // حفظ ملف (النسخة الاحتياطية)
    private String pendingName, pendingMime, pendingContent;
    private ActivityResultLauncher<Intent> saveLauncher, openLauncher, linkLauncher;
    private ValueCallback<Uri[]> fileCallback;

    @Override protected void onCreate(Bundle b) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(b);
        final long t0 = SystemClock.uptimeMillis();
        splash.setKeepOnScreenCondition(() -> !pageDone && SystemClock.uptimeMillis() - t0 < 1000);

        prefs = getSharedPreferences("gl", MODE_PRIVATE);
        dark = prefs.getBoolean("dark", true);
        WebView.setWebContentsDebuggingEnabled(false);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        applyBars();
        // نسيب مكان لشريط الحالة والملاحة والكيبورد بنفسنا (مع targetSdk 35 التطبيق بيترسم تحت الأشرطة)
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, in) -> {
            Insets bars = in.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = in.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        saveLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> {
            boolean ok = false;
            Uri u = r.getData() == null ? null : r.getData().getData();
            if (r.getResultCode() == RESULT_OK && u != null && pendingContent != null) ok = writeUri(u, pendingContent);
            boolean cancelled = r.getResultCode() != RESULT_OK;
            pendingContent = null;
            if (!cancelled) js("window.__glSaved&&__glSaved(" + ok + ")");
        });
        // الـ WebView ممنوع يقرا content:// (أمان)، فإحنا بنقرا الملف هنا ونديه للصفحة نصّ
        openLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> {
            if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
            Uri u = r.getResultCode() == RESULT_OK && r.getData() != null ? r.getData().getData() : null;
            if (u == null) return;
            String t = readUri(u);
            js("window.__glOpen&&__glOpen(" + (t == null ? "null" : org.json.JSONObject.quote(t)) + ")");
        });
        // ربط ملف للحفظ التلقائي: بناخد صلاحية دايمة عليه ونحفظ عنوانه
        linkLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> {
            Uri u = r.getResultCode() == RESULT_OK && r.getData() != null ? r.getData().getData() : null;
            if (u == null) { pendingContent = null; return; }
            boolean ok = false;
            try {
                getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                ok = pendingContent == null || writeUri(u, pendingContent);
                if (ok) prefs.edit().putString("link", u.toString()).putString("linkName", pendingName == null ? "gym-log.md" : pendingName).apply();
            } catch (Exception ignored) {}
            pendingContent = null;
            js("window.__glLinked&&__glLinked(" + ok + "," + org.json.JSONObject.quote(ok ? prefs.getString("linkName", "") : "") + ")");
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // localStorage / IndexedDB = بيانات التمرين
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT); // الـ service worker بيخدم الصفحة أوفلاين
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                      // حجم خط النظام ما يكسرش الشكل
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING))
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, false);
        else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK))
            WebSettingsCompat.setForceDark(s, WebSettingsCompat.FORCE_DARK_OFF);

        web.setBackgroundColor(dark ? DARK : LIGHT);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("gymlog".equals(u.getScheme())) { v.loadUrl(URL); return true; }   // زرار «إعادة المحاولة» في صفحة الأوفلاين
                if (isAppUrl(u)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) {}
                return true;                                                            // فيسبوك وأي رابط برّه: برّه التطبيق
            }
            @Override public void onPageStarted(WebView v, String url, Bitmap f) { trusted = url != null && isAppUrl(Uri.parse(url)); }
            @Override public void onPageFinished(WebView v, String url) { pageDone = true; onAppPage = trusted; }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (!r.isForMainFrame()) return;
                trusted = false; onAppPage = false; pageDone = true;
                v.loadDataWithBaseURL(null, readAsset("offline.html"), "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) { return true; }   // من غير لوجات في النسخة النهائية
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { openLauncher.launch(i); } catch (Exception e) { fileCallback = null; cb.onReceiveValue(null); return false; }
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, JsResult r) {   // الصفحة بتستخدم confirm() للمسح
                new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                        .setMessage(msg).setCancelable(true)
                        .setPositiveButton(android.R.string.ok, (d, w) -> r.confirm())
                        .setNegativeButton(android.R.string.cancel, (d, w) -> r.cancel())
                        .setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                        .setMessage(msg).setPositiveButton(android.R.string.ok, (d, w) -> r.confirm())
                        .setOnCancelListener(d -> r.confirm()).show();
                return true;
            }
        });
        // تنزيل blob: (احتياطي لو الصفحة استخدمت <a download>) بيتحوّل للـ bridge
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (!trusted || url == null || !url.startsWith("blob:")) return;
            String name = android.webkit.URLUtil.guessFileName(url, cd, mime);
            js("fetch(" + org.json.JSONObject.quote(url) + ").then(r=>r.text()).then(t=>Android.saveFile(" + org.json.JSONObject.quote(name) + "," + org.json.JSONObject.quote(mime == null ? "text/plain" : mime) + ",t))");
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (!onAppPage) { finish(); return; }
                // الويب بيتصرف الأول (يقفل نافذة / يرجع صفحة / يسأل «تخرج؟»)، ولو ما ردّش نخرج
                web.evaluateJavascript("(function(){try{return !!(window.glBack&&glBack())}catch(e){return false}})()",
                        v -> { if (!"true".equals(v)) finish(); });
            }
        });

        if (b != null) web.restoreState(b); else web.loadUrl(URL);
    }

    static boolean isAppUrl(Uri u) {
        String p = u.getPath() == null ? "" : u.getPath();
        return "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && (p.equals(PATH) || p.startsWith(PATH + "/"));
    }

    private boolean writeUri(Uri u, String content) {
        byte[] data = content.getBytes(StandardCharsets.UTF_8);
        for (String mode : new String[]{"wt", "w", "rwt"}) {   // بعض الأماكن (زي Drive) مش بتقبل "wt"
            try (OutputStream o = getContentResolver().openOutputStream(u, mode)) {
                if (o == null) continue;
                o.write(data); o.flush(); return true;
            } catch (Exception ignored) {}
        }
        return false;
    }

    private String readUri(Uri u) {
        try (InputStream in = getContentResolver().openInputStream(u)) {
            if (in == null) return null;
            ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int k;
            while ((k = in.read(buf)) > 0) { o.write(buf, 0, k); if (o.size() > MAX_FILE) return null; }
            return o.toString("UTF-8");
        } catch (Exception e) { return null; }
    }

    private String readAsset(String n) {
        try (InputStream in = getAssets().open(n)) {
            ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[4096]; int k;
            while ((k = in.read(buf)) > 0) o.write(buf, 0, k);
            return o.toString("UTF-8");
        } catch (Exception e) { return "<h1>Offline</h1>"; }
    }

    private void js(String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    private void applyBars() {
        int c = dark ? DARK : LIGHT;
        root.setBackgroundColor(c);
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(c));
        getWindow().setStatusBarColor(c);
        getWindow().setNavigationBarColor(c);
        WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(getWindow(), root);
        ic.setAppearanceLightStatusBars(!dark);
        ic.setAppearanceLightNavigationBars(!dark);
        if (web != null) web.setBackgroundColor(c);
    }

    /** الأوامر اللي الصفحة تقدر تناديها — بتشتغل بس لو الصفحة الحالية من origin التطبيق. */
    class Bridge {
        @JavascriptInterface public void saveFile(String name, String mime, String content) {
            if (!trusted || content == null || content.length() > MAX_FILE) return;
            String safe = (name == null ? "gymlog.txt" : name).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            if (safe.length() > 100 || safe.isEmpty()) safe = "gymlog.txt";
            String m = "text/markdown".equals(mime) || "text/csv".equals(mime) || "application/json".equals(mime) ? mime : "text/plain";
            pendingName = safe; pendingMime = m; pendingContent = content;
            final String fn = safe, fm = m;
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(fm).putExtra(Intent.EXTRA_TITLE, fn);
                try { saveLauncher.launch(i); } catch (Exception e) { pendingContent = null; js("window.__glSaved&&__glSaved(false)"); }
            });
        }
        @JavascriptInterface public void linkFile(String name, String content) {
            if (!trusted || content == null || content.length() > MAX_FILE) return;
            String safe = (name == null ? "gym-log.md" : name).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            pendingName = safe; pendingContent = content;
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/markdown").putExtra(Intent.EXTRA_TITLE, safe)
                        .addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                try { linkLauncher.launch(i); } catch (Exception e) { pendingContent = null; js("window.__glLinked&&__glLinked(false,'')"); }
            });
        }
        @JavascriptInterface public boolean writeLinked(String content) {
            if (!trusted || content == null || content.length() > MAX_FILE) return false;
            String l = prefs.getString("link", null);
            return l != null && writeUri(Uri.parse(l), content);
        }
        @JavascriptInterface public String linkedName() {
            if (!trusted || prefs.getString("link", null) == null) return "";
            return prefs.getString("linkName", "");
        }
        @JavascriptInterface public boolean copyText(String t) {
            if (!trusted || t == null || t.length() > 1000000) return false;
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("gymlog", t));
                return true;
            } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void keepAwake(boolean on) {
            if (!trusted) return;
            runOnUiThread(() -> { if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }
        @JavascriptInterface public void setBarsTheme(boolean isDark) {
            if (!trusted) return;
            runOnUiThread(() -> { dark = isDark; prefs.edit().putBoolean("dark", isDark).apply(); applyBars(); });
        }
        @JavascriptInterface public void exitApp() { if (trusted) runOnUiThread(MainActivity.this::finish); }
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() { if (web != null) { root.removeView(web); web.destroy(); } super.onDestroy(); }
}
