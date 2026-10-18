package ir.molido.hamsahm;
import java.util.Arrays;
import java.util.Calendar;
import java.util.TimeZone;
public final class ReminderPolicyTest {
 static void check(boolean ok){if(!ok)throw new AssertionError();}
 public static void main(String[] args){
  Calendar c=Calendar.getInstance(TimeZone.getTimeZone("Asia/Tehran"));c.set(2026,9,18,8,0,0);c.set(Calendar.MILLISECOND,0);Calendar result=(Calendar)c.clone();result.setTimeInMillis(ReminderPolicy.next(c,9));check(result.get(Calendar.DAY_OF_MONTH)==18&&result.get(Calendar.HOUR_OF_DAY)==9);
  c.set(Calendar.HOUR_OF_DAY,10);result.setTimeInMillis(ReminderPolicy.next(c,9));check(result.get(Calendar.DAY_OF_MONTH)==19&&result.get(Calendar.HOUR_OF_DAY)==9);
  check(ReminderPolicy.today(c).equals("2026-10-18"));check(ReminderPolicy.dueCount(Arrays.asList("2026-10-17","2026-10-18","2026-10-19"),"2026-10-18")==2);
  System.out.println("Reminder scheduling checks passed: future local hour, next-day rollover and due cutoff.");
 }
}
