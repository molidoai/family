package ir.molido.hamsahm;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

public final class UpdateManager {
    private static final String API="https://api.github.com/repos/molidoai/family/releases/latest";
    private static final long INTERVAL=24L*60*60*1000,MAX_APK=100L*1024*1024;
    private final Activity activity;
    private final SharedPreferences prefs;
    private final AtomicBoolean busy=new AtomicBoolean(false);
    private File ready;
    private String readyVersion,readyDigest;
    private long readySize;
    private AlertDialog offered;
    public UpdateManager(Activity activity){this.activity=activity;prefs=activity.getSharedPreferences("hamsahm_updates",0);}
    public boolean automatic(){return prefs.getBoolean("automatic",true);}
    public void setAutomatic(boolean value){prefs.edit().putBoolean("automatic",value).apply();toast(value?"بررسی خودکار فعال شد.":"بررسی خودکار خاموش شد.");}
    private boolean alive(){return !activity.isFinishing()&&!activity.isDestroyed();}
    private void ui(Runnable r){activity.runOnUiThread(()->{if(alive())r.run();});}
    private void toast(String s){if(alive())Toast.makeText(activity,s,Toast.LENGTH_LONG).show();}
    public String current(){try{return activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionName;}catch(Exception e){return "2.2.0";}}
    public void check(boolean manual){
        if(!manual&&(!automatic()||System.currentTimeMillis()-prefs.getLong("last_check",0)<INTERVAL))return;
        if(!busy.compareAndSet(false,true)){if(manual)toast("بررسی یا دریافت نسخه در حال انجام است.");return;}
        if(manual)toast("در حال بررسی نسخه جدید…");
        new Thread(()->{
            try{
                HttpURLConnection c=open(API,true);
                try{
                    int status=c.getResponseCode();
                    if(status==404){prefs.edit().putLong("last_check",System.currentTimeMillis()).apply();if(manual)ui(()->toast("هنوز نسخه‌ای در Releases مخزن صندوق منتشر نشده است یا مخزن در دسترس نیست."));return;}
                    if(status!=200)throw new Exception("دریافت اطلاعات نسخه ممکن نشد؛ اتصال اینترنت یا محدودیت گیت‌هاب را بررسی کنید.");
                    JSONObject release=new JSONObject(new String(read(c.getInputStream(),1024*1024),"UTF-8"));
                    if(release.optBoolean("draft")||release.optBoolean("prerelease"))throw new Exception("نسخه پایدار منتشر نشده است.");
                    String tag=release.getString("tag_name");
                    prefs.edit().putLong("last_check",System.currentTimeMillis()).apply();
                    if(UpdatePolicy.compareVersions(tag,current())<=0){if(manual)ui(()->toast("هم‌سهم به‌روز است؛ نسخه "+current()));return;}
                    JSONArray assets=release.getJSONArray("assets");JSONObject selected=null;
                    for(int i=0;i<assets.length();i++){JSONObject a=assets.getJSONObject(i);if("Hamsahm.apk".equals(a.optString("name"))){selected=a;break;}}
                    if(selected==null)throw new Exception("فایل Hamsahm.apk در انتشار جدید پیدا نشد.");
                    final String url=selected.getString("browser_download_url"),digest=UpdatePolicy.digest(selected.optString("digest"));
                    final long size=selected.getLong("size");
                    if(!UpdatePolicy.releaseUrl(url)||size<=0||size>MAX_APK)throw new Exception("نشانی یا اندازه فایل آپدیت معتبر نیست.");
                    ui(()->offer(tag,url,digest,size));
                }finally{c.disconnect();}
            }catch(Exception e){if(manual)ui(()->toast(e.getMessage()==null?"بررسی آپدیت ناموفق بود.":e.getMessage()));}
            finally{busy.set(false);}
        },"hamsahm-update-check").start();
    }
    private void offer(String version,String url,String hash,long size){
        if(offered!=null&&offered.isShowing())return;
        offered=new AlertDialog.Builder(activity).setTitle("نسخه جدید هم‌سهم "+version).setMessage("نسخه جدید با حجم "+Math.max(1,size/1024)+" کیلوبایت آماده است. پس از دریافت، امضا و صحت فایل بررسی می‌شود. برای نصب، تأیید اندروید لازم است. پیش از آپدیت، از اطلاعات صندوق پشتیبان بگیرید.").setPositiveButton("دریافت آپدیت",(d,w)->download(version,url,hash,size)).setNegativeButton("بعداً",null).create();offered.show();
    }
    private HttpURLConnection open(String value,boolean metadata)throws Exception{
        if(metadata&&!API.equals(value))throw new Exception("نشانی متادیتا معتبر نیست.");
        String next=value;
        for(int i=0;i<6;i++){
            if(!metadata&&!UpdatePolicy.downloadUrl(next))throw new Exception("انتقال دانلود به میزبان غیرمجاز متوقف شد.");
            HttpURLConnection c=(HttpURLConnection)new URL(next).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Hamsahm-Android/"+current());c.setRequestProperty("Accept",metadata?"application/vnd.github+json":"application/octet-stream");
            int status=c.getResponseCode();
            if(status>=300&&status<=399){String location=c.getHeaderField("Location");c.disconnect();if(metadata||location==null)throw new Exception("انتقال نشانی متادیتا مجاز نیست.");next=new URL(new URL(next),location).toString();continue;}
            return c;
        }throw new Exception("تعداد انتقال دانلود بیش از حد مجاز است.");
    }
    private byte[] read(InputStream source,int limit)throws Exception{try(InputStream in=source;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new Exception("پاسخ بیش از حد مجاز است.");out.write(b,0,n);}return out.toByteArray();}}
    private void download(String version,String url,String digest,long expectedSize){
        if(!busy.compareAndSet(false,true)){toast("عملیات دیگری در حال انجام است؛ دوباره تلاش کنید.");return;}
        ProgressDialog progress=new ProgressDialog(activity);progress.setTitle("دریافت نسخه جدید");progress.setMessage("فایل از گیت‌هاب دریافت می‌شود…");progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);progress.setMax(100);progress.setCancelable(false);progress.show();
        new Thread(()->{File part=null;
            try{
                File dir=new File(activity.getCacheDir(),"updates");if(!dir.isDirectory()&&!dir.mkdirs())throw new Exception("پوشه آپدیت ایجاد نشد.");
                part=new File(dir,"update.part");HttpURLConnection c=open(url,false);
                try{if(c.getResponseCode()!=200)throw new Exception("دریافت فایل ناموفق بود.");try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(part)){byte[] buffer=new byte[16384];int n;long count=0;long started=System.currentTimeMillis();while((n=in.read(buffer))!=-1){count+=n;if(count>expectedSize||count>MAX_APK||System.currentTimeMillis()-started>10*60*1000)throw new Exception("اندازه یا زمان دریافت فایل نامعتبر است.");out.write(buffer,0,n);final int percent=(int)(count*100/expectedSize);ui(()->progress.setProgress(percent));}if(count!=expectedSize)throw new Exception("دانلود ناقص است؛ دوباره تلاش کنید.");out.getFD().sync();}}finally{c.disconnect();}
                verify(part,version,digest,expectedSize);
                File apk=new File(dir,"update.apk");if(apk.exists()&&!apk.delete())throw new Exception("فایل آپدیت قبلی حذف نشد.");if(!part.renameTo(apk))throw new Exception("آماده‌سازی فایل آپدیت ناموفق بود.");
                ready=apk;readyVersion=version;readyDigest=digest;readySize=expectedSize;ui(()->{progress.dismiss();installReady();});
            }catch(Exception e){if(part!=null)part.delete();ui(()->{progress.dismiss();toast(e.getMessage()==null?"دانلود آپدیت ناموفق بود.":e.getMessage());});}
            finally{busy.set(false);}
        },"hamsahm-update-download").start();
    }
    private void verify(File file,String version,String expectedHash,long expectedSize)throws Exception{
        if(!file.isFile()||file.length()!=expectedSize)throw new Exception("اندازه فایل آپدیت مطابقت ندارد.");
        MessageDigest md=MessageDigest.getInstance("SHA-256");try(FileInputStream in=new FileInputStream(file)){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1)md.update(b,0,n);}StringBuilder hash=new StringBuilder();for(byte b:md.digest())hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));if(!hash.toString().equals(expectedHash))throw new Exception("هش فایل آپدیت مطابقت ندارد؛ نصب متوقف شد.");
        PackageManager pm=activity.getPackageManager();PackageInfo archive=pm.getPackageArchiveInfo(file.getAbsolutePath(),PackageManager.GET_SIGNATURES);PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNATURES);
        if(archive==null||!activity.getPackageName().equals(archive.packageName))throw new Exception("فایل متعلق به برنامه هم‌سهم نیست.");
        if(UpdatePolicy.compareVersions(archive.versionName,version)!=0||UpdatePolicy.compareVersions(archive.versionName,installed.versionName)<=0||code(archive)<=code(installed))throw new Exception("نسخه فایل با انتشار مطابقت ندارد یا جدیدتر نیست.");
        if(archive.applicationInfo==null||archive.applicationInfo.minSdkVersion>Build.VERSION.SDK_INT)throw new Exception("این نسخه با اندروید گوشی سازگار نیست.");
        Signature[] a=archive.signatures,b=installed.signatures;if(a==null||b==null||a.length!=1||b.length!=1||!MessageDigest.isEqual(a[0].toByteArray(),b[0].toByteArray()))throw new Exception("امضای نسخه جدید با هم‌سهم نصب‌شده یکسان نیست؛ نصب متوقف شد.");
    }
    private long code(PackageInfo info){return Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;}
    public void installReady(){
        if(ready==null||!ready.isFile())return;
        try{verify(ready,readyVersion,readyDigest,readySize);
            if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){
                new AlertDialog.Builder(activity).setTitle("اجازه نصب به‌روزرسانی").setMessage("در تنظیمات اندروید، اجازه نصب از هم‌سهم را فعال کنید و به برنامه برگردید.").setPositiveButton("بازکردن تنظیمات",(d,w)->{try{activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())),93);}catch(Exception e){toast("تنظیمات نصب در دسترس نیست.");}}).setNegativeButton("بعداً",null).show();return;
            }
            Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/update.apk");Intent intent=new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(intent);
        }catch(Exception e){toast(e.getMessage()==null?"نصب آپدیت شروع نشد.":e.getMessage());}
    }
    public void permissionResult(){if(Build.VERSION.SDK_INT<26||activity.getPackageManager().canRequestPackageInstalls())installReady();else toast("اجازه نصب فعال نشده است.");}
}
