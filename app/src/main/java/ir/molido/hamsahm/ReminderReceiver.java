package ir.molido.hamsahm;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){try{if("ir.molido.hamsahm.REMIND".equals(intent.getAction()))ReminderManager.show(context,false);}finally{ReminderManager.schedule(context);}}
}
