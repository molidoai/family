package ir.molido.hamsahm;
import java.net.URI;
import java.util.Locale;

public final class UpdatePolicy {
    private UpdatePolicy(){}
    public static int compareVersions(String a, String b) {
        int[] left=version(a),right=version(b);
        for(int i=0;i<3;i++)if(left[i]!=right[i])return Integer.compare(left[i],right[i]);
        return 0;
    }
    private static int[] version(String value) {
        if(value==null||!value.matches("v?[0-9]{1,5}\\.[0-9]{1,5}\\.[0-9]{1,5}"))throw new IllegalArgumentException("نسخه منتشرشده معتبر نیست.");
        String[] p=value.replaceFirst("^v", "").split("\\.");return new int[]{Integer.parseInt(p[0]),Integer.parseInt(p[1]),Integer.parseInt(p[2])};
    }
    public static String digest(String value) {
        if(value==null||!value.matches("sha256:[a-fA-F0-9]{64}"))throw new IllegalArgumentException("هش SHA-256 فایل در انتشار گیت‌هاب ثبت نشده است.");
        return value.substring(7).toLowerCase(Locale.ROOT);
    }
    public static boolean releaseUrl(String value) {
        try{URI uri=new URI(value);return "https".equals(uri.getScheme())&&"github.com".equals(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&uri.getPath().startsWith("/molidoai/family/releases/download/");}catch(Exception e){return false;}
    }
    public static boolean downloadUrl(String value) {
        try{URI uri=new URI(value);String host=uri.getHost();return "https".equals(uri.getScheme())&&uri.getUserInfo()==null&&uri.getPort()==-1&&host!=null&&(host.equals("github.com")||host.equals("release-assets.githubusercontent.com")||host.equals("objects.githubusercontent.com")||host.equals("github-releases.githubusercontent.com"));}catch(Exception e){return false;}
    }
}
