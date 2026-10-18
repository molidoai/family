package ir.molido.hamsahm;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class AppLock {
    public static final int CREDENTIAL_REQUEST=94;
    private final Activity activity;
    private final SharedPreferences prefs;
    private final FrameLayout cover;
    private final Runnable changed;
    private boolean unlocked,authenticating;
    private Runnable authenticated;
    private CancellationSignal signal;
    public AppLock(Activity activity,FrameLayout parent,Runnable changed){
        this.activity=activity;this.changed=changed;prefs=activity.getSharedPreferences("hamsahm_security",0);unlocked=!enabled();
        cover=new FrameLayout(activity);cover.setBackgroundColor(Color.rgb(18,62,50));cover.setClickable(true);cover.setFocusable(true);
        LinearLayout box=new LinearLayout(activity);box.setOrientation(LinearLayout.VERTICAL);box.setGravity(Gravity.CENTER);box.setPadding(48,48,48,48);
        TextView logo=new TextView(activity);logo.setText("◈\nهم‌سهم");logo.setGravity(Gravity.CENTER);logo.setTextColor(Color.rgb(224,195,121));logo.setTextSize(34);box.addView(logo);
        TextView description=new TextView(activity);description.setText("برای دیدن اطلاعات صندوق، هویت خود را تأیید کنید.");description.setTextColor(Color.WHITE);description.setGravity(Gravity.CENTER);description.setPadding(0,40,0,40);box.addView(description);
        Button unlock=new Button(activity);unlock.setText("بازکردن با رمز یا اثر انگشت گوشی");unlock.setOnClickListener(v->unlock());box.addView(unlock);
        TextView hint=new TextView(activity);hint.setText("رمز ورود همان رمز یا الگوی قفل گوشی شماست.");hint.setTextColor(Color.rgb(195,211,195));hint.setGravity(Gravity.CENTER);hint.setPadding(0,24,0,0);box.addView(hint);
        cover.addView(box,new FrameLayout.LayoutParams(-1,-1));parent.addView(cover,new FrameLayout.LayoutParams(-1,-1));applySecure();cover.setVisibility(enabled()?View.VISIBLE:View.GONE);
    }
    public boolean enabled(){return prefs.getBoolean("lock_enabled",false);}
    public boolean allowsAccess(){return !enabled()||unlocked;}
    private boolean deviceSecure(){KeyguardManager keyguard=(KeyguardManager)activity.getSystemService(Activity.KEYGUARD_SERVICE);return keyguard!=null&&keyguard.isDeviceSecure();}
    private void message(String text){Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
    private void applySecure(){if(enabled())activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);}
    public void lock(){if(!enabled())return;unlocked=false;cover.setVisibility(View.VISIBLE);cover.bringToFront();}
    public void onResume(){if(enabled()&&!unlocked){cover.setVisibility(View.VISIBLE);cover.bringToFront();}}
    public void change(boolean requested){
        if(requested==enabled())return;
        if(!deviceSecure()){message("ابتدا برای گوشی خود پین، رمز یا الگوی قفل تنظیم کنید.");changed.run();return;}
        authenticate(()->{prefs.edit().putBoolean("lock_enabled",requested).apply();unlocked=true;cover.setVisibility(View.GONE);applySecure();message(requested?"قفل هم‌سهم فعال شد.":"قفل هم‌سهم خاموش شد.");changed.run();});
    }
    public void unlock(){if(!enabled()){unlocked=true;cover.setVisibility(View.GONE);return;}authenticate(()->{unlocked=true;cover.setVisibility(View.GONE);changed.run();});}
    private void authenticate(Runnable success){
        if(authenticating)return;if(!deviceSecure()){message("قفل امن گوشی فعال نیست؛ آن را در تنظیمات اندروید فعال کنید.");return;}
        authenticated=success;authenticating=true;
        if(Build.VERSION.SDK_INT>=29){
            try{
                BiometricPrompt.Builder builder=new BiometricPrompt.Builder(activity).setTitle("ورود به هم‌سهم").setSubtitle("تأیید هویت با قفل امن گوشی");
                if(Build.VERSION.SDK_INT>=30)builder.setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG|android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL);
                else if(Build.VERSION.SDK_INT>=29)builder.setDeviceCredentialAllowed(true);
                signal=new CancellationSignal();builder.build().authenticate(signal,activity::runOnUiThread,new BiometricPrompt.AuthenticationCallback(){
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){complete();}
                    @Override public void onAuthenticationError(int code,CharSequence error){if(code==BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED||code==BiometricPrompt.BIOMETRIC_ERROR_CANCELED){cancel();return;}credential();}
                });return;
            }catch(Exception ignored){}
        }
        credential();
    }
    private void credential(){
        if(!authenticating)return;
        KeyguardManager manager=(KeyguardManager)activity.getSystemService(Activity.KEYGUARD_SERVICE);
        Intent intent=manager==null?null:manager.createConfirmDeviceCredentialIntent("ورود به هم‌سهم","رمز، پین یا الگوی گوشی خود را وارد کنید.");
        if(intent==null){cancel();message("تأیید قفل گوشی در دسترس نیست.");return;}
        try{activity.startActivityForResult(intent,CREDENTIAL_REQUEST);}catch(Exception e){cancel();message("صفحه تأیید هویت باز نشد.");}
    }
    public void credentialResult(boolean ok){if(ok)complete();else cancel();}
    private void complete(){Runnable callback=authenticated;authenticated=null;authenticating=false;signal=null;if(callback!=null)callback.run();}
    private void cancel(){authenticated=null;authenticating=false;signal=null;changed.run();}
    public void destroy(){authenticated=null;authenticating=false;if(signal!=null)signal.cancel();signal=null;}
}
