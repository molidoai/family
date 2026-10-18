package ir.molido.hamsahm;
public final class UpdatePolicyTest {
    static void check(boolean condition){if(!condition)throw new AssertionError();}
    static void rejects(Runnable run){try{run.run();throw new AssertionError("Expected rejection");}catch(IllegalArgumentException expected){}}
    public static void main(String[] args){
        check(UpdatePolicy.compareVersions("v2.10.0","2.9.9")>0);
        check(UpdatePolicy.compareVersions("v2.1.0","2.1.0")==0);
        check(UpdatePolicy.compareVersions("2.0.9","2.1.0")<0);
        rejects(()->UpdatePolicy.compareVersions("v2.1.0-beta","2.1.0"));
        rejects(()->UpdatePolicy.compareVersions("../../evil","2.1.0"));
        String hash="a".repeat(64);check(UpdatePolicy.digest("sha256:"+hash).equals(hash));rejects(()->UpdatePolicy.digest(""));rejects(()->UpdatePolicy.digest("md5:"+hash));
        check(UpdatePolicy.releaseUrl("https://github.com/molidoai/family/releases/download/v2.1.0/Hamsahm.apk"));
        check(!UpdatePolicy.releaseUrl("http://github.com/molidoai/family/releases/download/v2.1.0/Hamsahm.apk"));
        check(!UpdatePolicy.releaseUrl("https://github.com/other/repo/releases/download/v2.1.0/Hamsahm.apk"));
        check(!UpdatePolicy.releaseUrl("https://github.com.evil.test/molidoai/family/releases/download/v2.1.0/Hamsahm.apk"));
        check(!UpdatePolicy.releaseUrl("https://user@github.com/molidoai/family/releases/download/v2.1.0/Hamsahm.apk"));
        check(UpdatePolicy.downloadUrl("https://release-assets.githubusercontent.com/github-production-release-asset/file.apk"));
        check(!UpdatePolicy.downloadUrl("https://release-assets.githubusercontent.com.evil.test/file.apk"));
        check(!UpdatePolicy.downloadUrl("file:///tmp/file.apk"));
        System.out.println("Update policy checks passed: version ordering, malformed versions, SHA-256 requirement, repo path and redirect host restrictions.");
    }
}
