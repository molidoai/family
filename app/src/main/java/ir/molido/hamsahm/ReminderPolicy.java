package ir.molido.hamsahm;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
public final class ReminderPolicy {
    private ReminderPolicy(){}
    public static String today(Calendar calendar){return String.format(Locale.ROOT,"%04d-%02d-%02d",calendar.get(Calendar.YEAR),calendar.get(Calendar.MONTH)+1,calendar.get(Calendar.DAY_OF_MONTH));}
    public static long next(Calendar now,int hour){if(hour<0||hour>23)throw new IllegalArgumentException("Invalid hour");Calendar next=(Calendar)now.clone();next.set(Calendar.HOUR_OF_DAY,hour);next.set(Calendar.MINUTE,0);next.set(Calendar.SECOND,0);next.set(Calendar.MILLISECOND,0);if(next.getTimeInMillis()<=now.getTimeInMillis())next.add(Calendar.DAY_OF_YEAR,1);return next.getTimeInMillis();}
    public static int dueCount(List<String> dates,String today){int count=0;for(String date:dates)if(date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")&&date.compareTo(today)<=0)count++;return count;}
}
