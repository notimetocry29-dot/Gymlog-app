package com.gymlog.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.*;
import android.widget.Toast;
import java.io.OutputStream;

public class MainActivity extends Activity {
    // نفس صفحتك على GitHub Pages — أي تحديث تنشره بيظهر في التطبيق تلقائيًا
    private static final String APP_URL = "https://notimetocry29-dot.github.io/Gymlog-app/";
    private static final String HOST = "notimetocry29-dot.github.io";
    private WebView web;
    private ValueCallback<Uri[]> filePicker;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0E0E0F);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // لو مفيش نت: افتح من الكاش (الـ service worker بتاع الموقع شغال برضه)
        s.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost()) || "blob".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = cb;
                try { startActivityForResult(p.createIntent(), 1); }
                catch (Exception e) { filePicker = null; return false; }
                return true;
            }
        });
        // النسخ الاحتياطي بيتحمّل كـ blob: بنمسكه ونحفظه في Downloads
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (url.startsWith("blob:")) {
                String name = URLUtil.guessFileName(url, cd, mime);
                web.evaluateJavascript("(function(){var n=" + JSONQuote(name) + ";fetch('" + url + "').then(function(r){return r.blob()}).then(function(bl){var fr=new FileReader();fr.onloadend=function(){AndroidBridge.save(n,bl.type||'application/octet-stream',fr.result.split(',')[1])};fr.readAsDataURL(bl)})})()", null);
            } else {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
            }
        });

        if (b == null) web.loadUrl(APP_URL); else web.restoreState(b);
    }

    private static String JSONQuote(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        return cm.getActiveNetworkInfo() != null && cm.getActiveNetworkInfo().isConnected();
    }

    class Bridge {
        @JavascriptInterface
        public void save(String name, String mime, String base64) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                Uri uri;
                if (Build.VERSION.SDK_INT >= 29) {
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                } else {
                    java.io.File f = new java.io.File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
                    uri = Uri.fromFile(f);
                }
                try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(data); }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "اتحفظ في Downloads: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "فشل الحفظ", Toast.LENGTH_LONG).show());
            }
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == 1 && filePicker != null) {
            filePicker.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            filePicker = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
}
