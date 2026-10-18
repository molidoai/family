package ir.molido.hamsahm;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    private static final int SAVE_DOCUMENT = 41, OPEN_DOCUMENT = 42;
    private static final int MAX_BYTES = 16 * 1024 * 1024;
    private final Set<String> files = new HashSet<>(Arrays.asList("index.html", "app.js", "core.js", "backup-crypto.js", "native-controls.js", "reminders.js", "style.css", "icon.svg", "logo.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"));
    private WebView web;
    private UpdateManager updates;
    private AppLock appLock;
    private byte[] pendingExport;
    private ValueCallback<Uri[]> chooser;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(18,62,50));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets system = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(system.left, system.top, system.right, Math.max(system.bottom, ime.bottom));
            }
            return insets;
        });
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1)); setContentView(root);
        web.setBackgroundColor(Color.rgb(246,247,242));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false); settings.setJavaScriptCanOpenWindowsAutomatically(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!trusted(uri) || !"GET".equals(request.getMethod())) return blocked();
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/")) return blocked();
                String name = path.substring(8);
                if (!files.contains(name)) return blocked();
                try {
                    String mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".png") ? "image/png" : name.endsWith(".webmanifest") ? "application/manifest+json" : "text/html";
                    HashMap<String,String> headers = new HashMap<>();
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, getAssets().open("www/" + name));
                } catch (Exception e) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (trusted(uri) && uri.getPath() != null && uri.getPath().equals("/assets/index.html")) return false;
                if (request.isForMainFrame()) external(uri);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("باشه", (d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("تأیید", (d,w)->result.confirm()).setNegativeButton("انصراف",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(intent, OPEN_DOCUMENT); } catch (ActivityNotFoundException e) { chooser.onReceiveValue(null); chooser = null; }
                return true;
            }
        });
        updates = new UpdateManager(this);
        appLock = new AppLock(this,root,()->{if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('hamsahm-security-changed'))",null);});
        ReminderManager.schedule(this);
        web.addJavascriptInterface(new Bridge(), "HamsahmNative");
        web.loadUrl(START);
    }
    private boolean trusted(Uri uri) { return uri != null && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null; }
    private boolean localPage() { return web != null && (appLock==null||appLock.allowsAccess()) && trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl())); }
    private WebResourceResponse blocked() { return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", new HashMap<>(), new ByteArrayInputStream(new byte[0])); }
    private void external(Uri uri) {
        if (uri == null || !"https".equals(uri.getScheme()) || uri.getUserInfo() != null || uri.getHost() == null) { toast("فقط لینک HTTPS معتبر مجاز است."); return; }
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); } catch (ActivityNotFoundException e) { toast("مرورگر برای بازکردن لینک پیدا نشد."); }
    }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    public final class Bridge {
        @JavascriptInterface public String securityInfo(){try{org.json.JSONObject out=new org.json.JSONObject();out.put("locked",appLock.enabled());out.put("reminders",ReminderManager.enabled(MainActivity.this));out.put("hour",ReminderManager.hour(MainActivity.this));out.put("notificationsAllowed",ReminderManager.permitted(MainActivity.this));return out.toString();}catch(Exception e){return "{}";}}
        @JavascriptInterface public void setAppLock(boolean enabled){runOnUiThread(()->{if(localPage())appLock.change(enabled);});}
        @JavascriptInterface public void lockNow(){runOnUiThread(()->{if(localPage())appLock.lock();});}
        @JavascriptInterface public void configureReminders(boolean enabled,int hour){runOnUiThread(()->{if(localPage()){ReminderManager.configure(MainActivity.this,enabled,hour);web.evaluateJavascript("window.dispatchEvent(new Event('hamsahm-security-changed'))",null);}});}
        @JavascriptInterface public void reminderSnapshot(String value){runOnUiThread(()->{if(localPage())ReminderManager.snapshot(MainActivity.this,value);});}
        @JavascriptInterface public void testReminder(){runOnUiThread(()->{if(localPage())ReminderManager.test(MainActivity.this);});}

        @JavascriptInterface public void checkUpdates(){runOnUiThread(()->{if(localPage())updates.check(true);});}
        @JavascriptInterface public void setAutomaticUpdates(boolean enabled){runOnUiThread(()->{if(localPage())updates.setAutomatic(enabled);});}
        @JavascriptInterface public String updateInfo(){try{org.json.JSONObject data=new org.json.JSONObject();data.put("version",updates.current());data.put("automatic",updates.automatic());return data.toString();}catch(Exception e){return "{}";}}
        @JavascriptInterface public void exportText(String content, String filename, String mime) {
            if (content == null || content.length() > MAX_BYTES) { runOnUiThread(()->exportResult(false)); return; }
            final byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_BYTES) { runOnUiThread(()->exportResult(false)); return; }
            runOnUiThread(()->{
                if (!localPage()) { exportResult(false); return; }
                if (pendingExport != null) { toast("ابتدا پنجره ذخیره قبلی را ببندید."); exportResult(false); return; }
                pendingExport = bytes;
                String safeName = filename == null ? "Hamsahm-backup.json" : filename.replaceAll("[^A-Za-z0-9._-]", "_");
                String safeMime = "text/csv;charset=utf-8".equals(mime) ? "text/csv" : "application/json";
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(safeMime).putExtra(Intent.EXTRA_TITLE, safeName);
                try { startActivityForResult(intent, SAVE_DOCUMENT); } catch (Exception e) { pendingExport = null; toast("پنجره ذخیره فایل باز نشد."); exportResult(false); }
            });
        }
        @JavascriptInterface public void openPayment(String value) { runOnUiThread(()->{ if (localPage() && value != null && value.length()<2001) external(Uri.parse(value)); }); }
        @JavascriptInterface public void copyText(String value) { runOnUiThread(()->{ if (!localPage() || value == null || value.length()>4096) return; ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("هم‌سهم", value)); toast("لینک کپی شد."); }); }
        @JavascriptInterface public void printPage() { runOnUiThread(()->{ if (localPage()) printWeb(); }); }
    }
    private void exportResult(boolean success) { if(web!=null) web.evaluateJavascript("window.hamsahmExportResult && window.hamsahmExportResult("+(success?"true":"false")+")",null); }
    private void printWeb() {
        PrintManager manager = (PrintManager)getSystemService(Context.PRINT_SERVICE);
        if (manager == null) { toast("سرویس چاپ در دسترس نیست."); return; }
        final PrintDocumentAdapter delegate = web.createPrintDocumentAdapter("Hamsahm-report");
        manager.print("هم‌سهم", new PrintDocumentAdapter() {
            @Override public void onStart(){delegate.onStart();}
            @Override public void onLayout(PrintAttributes oldAttrs, PrintAttributes attrs, CancellationSignal signal, LayoutResultCallback callback, Bundle extras){delegate.onLayout(oldAttrs,attrs,signal,callback,extras);}
            @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal signal, WriteResultCallback callback){delegate.onWrite(pages,destination,signal,callback);}
            @Override public void onFinish(){delegate.onFinish();if(web!=null)web.post(()->web.evaluateJavascript("window.dispatchEvent(new Event('afterprint'))",null));}
        }, new PrintAttributes.Builder().build());
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if(request==AppLock.CREDENTIAL_REQUEST){appLock.credentialResult(result==RESULT_OK);return;}
        if(request==93){updates.permissionResult();return;}
        if (request == OPEN_DOCUMENT) { if (chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);chooser=null;}return; }
        if (request == SAVE_DOCUMENT) {
            final byte[] bytes = pendingExport; pendingExport = null;
            if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) { toast("ذخیره فایل لغو شد."); exportResult(false); return; }
            final Uri uri = data.getData();
            new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new Exception();out.write(bytes);runOnUiThread(()->{toast("فایل ذخیره شد.");exportResult(true);});}catch(Exception e){runOnUiThread(()->{toast("ذخیره فایل ناموفق بود؛ دوباره پشتیبان بگیرید.");exportResult(false);});}}).start();
        }
    }
    @Override protected void onResume(){super.onResume();if(appLock!=null)appLock.onResume();if(web!=null)web.postDelayed(()->{if(updates!=null&&!isFinishing()&&!isDestroyed()&&(appLock==null||appLock.allowsAccess()))updates.check(false);},2000);}
    @Override protected void onStop(){if(appLock!=null)appLock.lock();super.onStop();}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==ReminderManager.REQUEST_NOTIFICATION){toast(ReminderManager.permitted(this)?"اجازه اعلان‌ها فعال شد.":"اعلان‌ها مجاز نیستند؛ یادآوری در تنظیمات اندروید قابل فعال‌سازی است.");if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('hamsahm-security-changed'))",null);}}

    @Override public void onBackPressed(){if(appLock!=null&&!appLock.allowsAccess()){finish();return;}web.evaluateJavascript("(function(){if(window.hamsahmCloseDrawer&&window.hamsahmCloseDrawer())return true;const d=document.querySelector('dialog[open]');if(d){d.close();return true}if(location.hash&&location.hash!=='#home'){location.hash='home';return true}return false})()",value->{if(!"true".equals(value))new AlertDialog.Builder(this).setMessage("از هم‌سهم خارج می‌شوید؟").setPositiveButton("خروج",(d,w)->finish()).setNegativeButton("ماندن",null).show();});}
    @Override protected void onDestroy(){if(appLock!=null)appLock.destroy();if(chooser!=null)chooser.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("HamsahmNative");web.destroy();web=null;}pendingExport=null;super.onDestroy();}
}
