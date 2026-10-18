package ir.molido.hamsahm;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public final class ReminderManager {
    public static final int REQUEST_NOTIFICATION=95;
    private static final String CHANNEL="hamsahm_due",ACTION="ir.molido.hamsahm.REMIND",PREFS="hamsahm_reminders";
    private static SharedPreferences prefs(Context context){return context.getSharedPreferences(PREFS,0);}
    public static boolean enabled(Context c){return prefs(c).getBoolean("enabled",false);}
    public static int hour(Context c){return prefs(c).getInt("hour",9);}
    private static PendingIntent alarm(Context c){return PendingIntent.getBroadcast(c,421,new Intent(c,ReminderReceiver.class).setAction(ACTION),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    public static void schedule(Context c){AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);if(manager==null)return;manager.cancel(alarm(c));if(!enabled(c))return;long when=ReminderPolicy.next(Calendar.getInstance(),hour(c));manager.setWindow(AlarmManager.RTC_WAKEUP,when,60*60*1000,alarm(c));}
    public static void configure(Activity activity,boolean requested,int hour){
        if(hour<0||hour>23){Toast.makeText(activity,"ساعت باید بین ۰ تا ۲۳ باشد.",Toast.LENGTH_LONG).show();return;}
        prefs(activity).edit().putInt("hour",hour).putBoolean("enabled",requested).apply();schedule(activity);
        if(requested&&Build.VERSION.SDK_INT>=33&&activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQUEST_NOTIFICATION);}
        else Toast.makeText(activity,requested?"یادآوری محلی فعال شد؛ زمان نمایش ممکن است با مدیریت باتری اندروید تأخیر داشته باشد.":"یادآوری خاموش شد.",Toast.LENGTH_LONG).show();
    }
    public static boolean permitted(Context c){if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(manager==null||!manager.areNotificationsEnabled())return false;if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=manager.getNotificationChannel(CHANNEL);if(channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;}return true;}
    public static void snapshot(Context c,String json){
        if(json==null||json.length()>512000)return;
        try{JSONObject data=new JSONObject(json);JSONArray dates=data.getJSONArray("installments"),dues=data.getJSONArray("shares");if(dates.length()+dues.length()>12000)return;validateDates(dates);validateDates(dues);prefs(c).edit().putString("snapshot",data.toString()).apply();}catch(Exception ignored){}
    }
    private static void validateDates(JSONArray dates)throws Exception{for(int i=0;i<dates.length();i++)if(!dates.getString(i).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw new IllegalArgumentException();}
    private static List<String> list(JSONArray array)throws Exception{List<String> out=new ArrayList<>();for(int i=0;i<array.length();i++)out.add(array.getString(i));return out;}
    public static void show(Context context,boolean test){
        if(!test&&!enabled(context))return;if(!permitted(context))return;
        String today=ReminderPolicy.today(Calendar.getInstance());if(!test&&today.equals(prefs(context).getString("last_notification","")))return;
        int installments=0,shares=0;
        try{JSONObject s=new JSONObject(prefs(context).getString("snapshot","{}"));installments=ReminderPolicy.dueCount(list(s.getJSONArray("installments")),today);shares=ReminderPolicy.dueCount(list(s.getJSONArray("shares")),today);}catch(Exception ignored){}
        if(!test&&installments+shares==0)return;
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,"یادآوری سهم و اقساط",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("یادآوری محلی برای مدیر صندوق؛ بدون نمایش نام و مبلغ روی صفحه قفل");manager.createNotificationChannel(channel);}
        Intent open=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent intent=PendingIntent.getActivity(context,422,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("هم‌سهم — یادآوری صندوق").setContentText(test?"یادآوری آزمایشی فعال است.":"سهم یا اقساط سررسیدشده دارید؛ دفتر صندوق را بررسی کنید.").setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(intent).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER);
        manager.notify(test?423:424,builder.build());if(!test)prefs(context).edit().putString("last_notification",today).apply();
    }
    public static void test(Activity activity){if(!permitted(activity)){Toast.makeText(activity,"اجازه اعلان‌ها را در تنظیمات اندروید فعال کنید.",Toast.LENGTH_LONG).show();try{activity.startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,activity.getPackageName()));}catch(Exception ignored){}return;}show(activity,true);}
}
