# Jotaish for Android

A Trusted Web Activity: the app opens https://jotaish.online full screen in
Chrome, so the service worker, offline readings and sign-in work exactly as
in the installed web app. Generated with Bubblewrap from the site's web app
manifest; settings are in `twa-manifest.json` (app ID `online.jotaish.app`).

Requires Java 17+ and the Android SDK.

## Test build

```bash
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug
```

Install `app/build/outputs/apk/debug/app-debug.apk` on a phone. Until the
site lists this build's signing key (below), Chrome shows a small address
bar at the top; that is the only difference.

## Release build (Google Play)

1. Create the upload key once and keep it safe, outside Git. Losing it means
   asking Google to reset it.

   ```bash
   keytool -genkeypair -v -keystore jotaish-upload.keystore -alias jotaish -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Build the signed bundle and APK. Bubblewrap asks for the key passwords.

   ```bash
   npx @bubblewrap/cli build
   ```

   This writes `app-release-bundle.aab` (for Play) and `app-release-signed.apk`.

3. In Play Console, create the app and upload the `.aab`. Under
   **Test and release → App integrity → App signing**, copy the
   **App signing key certificate** SHA-256 fingerprint. Play re-signs the app
   with this key, so it is the one phones see.

4. On the server, list the fingerprints the site should trust in
   `apps/web/.env.production` (comma-separated: Play's app signing key, and
   your upload key if you also hand out the APK directly), then restart the
   website:

   ```bash
   ANDROID_CERT_FINGERPRINTS="AA:BB:...,CC:DD:..."
   ```

   Your upload key's fingerprint: `keytool -list -v -keystore jotaish-upload.keystore -alias jotaish`.

5. Check https://jotaish.online/.well-known/assetlinks.json shows them. Once
   it does, the app opens with no address bar.

## Updating

Bump `appVersionCode` and `appVersionName` in `twa-manifest.json`, run
`npx @bubblewrap/cli update`, then build again. Changes to the website itself
need no app update.
