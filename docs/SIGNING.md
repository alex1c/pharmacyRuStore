# Android release signing (no secrets)

Production signing for **Моя аптечка** uses a **dedicated** keystore (not shared with other apps).

## Local layout (gitignored)

```
keystore/
  pharmacy-release.jks
  keystore.properties   # storePassword / keyPassword / keyAlias / storeFile
  README.local.txt
  cert-info.local.txt   # fingerprints only, optional
```

`.gitignore` already excludes `keystore/`, `*.jks`, `*.keystore`, `*.aab`, `/android`.

## Alias

- Alias: `pharmacy`
- Package: `com.calculatorplatform.pharmacy`

## Build flow

```bash
npx expo prebuild --platform android --clean
node scripts/configure-android-signing.js
cd android
.\\gradlew.bat bundleRelease
```

Copy AAB to:

`release-artifacts/pharmacy-1.0.0-v1.aab`

## Verify (no passwords printed)

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
# or apksigner / bundletool as available
```

Never commit keystore files, `keystore.properties`, or passwords.
