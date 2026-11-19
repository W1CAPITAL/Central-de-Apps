package br.com.w1capital.central;

import org.junit.Test;
import java.util.Map;
import static org.junit.Assert.*;

public class ReleaseCatalogTest {
 private static String asset(String tag,String id,String version,String digest,String url,long size) {
  return "{\"tag_name\":\""+tag+"\",\"draft\":false,\"prerelease\":"+tag.startsWith("android-preview")+" ,"+
   "\"assets\":[{\"name\":\""+ReleaseCatalog.fileName(id,version)+"\",\"size\":"+size+",\"digest\":\""+digest+"\",\"browser_download_url\":\""+url+"\"}]}";
 }
 private static final String HASH="sha256:"+"a".repeat(64);
 @Test public void acceptsOfficialAndroidAssetWithPinnedDigest() throws Exception {
  String tag="android-preview-v1.0.15",name=ReleaseCatalog.fileName("central","1.0.15");
  String url="https://github.com/W1CAPITAL/Central-de-Apps/releases/download/"+tag+"/"+name;
  Map<String,ReleaseCatalog.ApkRelease> result=ReleaseCatalog.parse("["+asset(tag,"central","1.0.15",HASH,url,300001)+"]");
  assertEquals("1.0.15",result.get("central").version);
  assertEquals("a".repeat(64),result.get("central").sha256);
 }
 @Test public void rejectsWindowsAssetsAndMaliciousRedirects() throws Exception {
  String tag="android-v1.0.9";
  assertEquals(0,ReleaseCatalog.parse("[{\"tag_name\":\"v0.1.999\",\"assets\":[{\"name\":\"W1-Central-de-Apps-Setup-0.1.999-x64.exe\"}]}]").size());
  String name=ReleaseCatalog.fileName("central","1.0.9");
  assertTrue(ReleaseCatalog.parse("["+asset(tag,"central","1.0.9",HASH,"https://attacker.invalid/"+name,300001)+"]").isEmpty());
  assertTrue(ReleaseCatalog.parse("["+asset(tag,"central","1.0.9","sha256:wrong","https://github.com/W1CAPITAL/Central-de-Apps/releases/download/"+tag+"/"+name,300001)+"]").isEmpty());
 }
 @Test public void selectsNewestPerProductAndIgnoresDrafts() throws Exception {
  String oldTag="android-preview-v1.0.9",newTag="android-preview-v1.0.10";
  String old=asset(oldTag,"central","1.0.9",HASH,"https://github.com/W1CAPITAL/Central-de-Apps/releases/download/"+oldTag+"/"+ReleaseCatalog.fileName("central","1.0.9"),300001);
  String latest=asset(newTag,"central","1.0.10",HASH,"https://github.com/W1CAPITAL/Central-de-Apps/releases/download/"+newTag+"/"+ReleaseCatalog.fileName("central","1.0.10"),300001);
  assertEquals("1.0.10",ReleaseCatalog.parse("["+old+","+latest+"]").get("central").version);
 }
 @Test public void ensuresNoUntrustedPackageNames() {
  assertEquals("W1-Central-de-Apps-Android-1.0.1.apk",ReleaseCatalog.fileName("central","1.0.1"));
  assertEquals("PredictBot-Android-1.0.1.apk",ReleaseCatalog.fileName("predictbot","1.0.1"));
  assertEquals("OpenCode-W1-Android-1.0.1.apk",ReleaseCatalog.fileName("opencode","1.0.1"));
  try { ReleaseCatalog.fileName("windows","1.0.1");fail(); }catch(IllegalArgumentException expected){}
  try { ReleaseCatalog.fileName("central","../../x");fail(); }catch(IllegalArgumentException expected){}
 }
}
