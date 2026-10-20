# IPTV Player (Android · iOS · Web)

A cross-platform live-TV player built with Expo (React Native + React Native Web) and expo-router.
It plays channel links from the **iptv-org/iptv** project, limited to **Tamil and English** channels
(3,118 bundled: 131 Tamil, 3,021 English; built from the `languages/tam.m3u` and `languages/eng.m3u` playlists),
and lets you add your own stream or playlist links.

## Android TV (remote control)
The same app runs on Android TV: on a TV it opens a full-screen TV experience at `/tv` instead of the phone UI.

| Remote button | Action |
|---|---|
| **0–9** | Type a channel number (1 = Sun TV, 2 = Star Vijay, 3 = Zee Tamil …). Waits ~2 s for more digits, or tunes at once when no longer number exists; **OK** tunes immediately |
| **Channel +/−** (also Page Up/Down, Next/Previous) | Next / previous channel in your lineup (wraps around) |
| **D-pad Up / Down** | Same as channel +/− while watching |
| **OK / D-pad Left / Guide / Menu** | Open the channel guide |
| **0** (alone) / **Last** | Previous channel |
| **Info / D-pad Right** | Show channel banner |
| **Back** | Close guide / cancel number entry; press twice to exit |

- **Lineup:** the numbered list the digits refer to. First launch seeds Tamil channels first, then English news (Sun TV, Star Vijay, Zee Tamil, Colors Tamil, Raj TV, Kalaignar, Polimer, Thanthi, Puthiya Thalaimurai, News 7, Jaya Plus, CNN, BBC, Al Jazeera, DW, France 24, CNA, Red Bull TV). Missing channels are skipped. In the guide: **My Lineup** tab has ▲ ▼ ✕ to reorder/remove; **Tamil / English** tabs have **＋ Lineup** to add. Saved on the device.
- **Failover:** if a stream errors or doesn't start within 20 s, the app tries other sources of the same channel automatically, then shows "No signal" (OK retries).
- **Fullscreen** video, screen kept awake while watching, ~15 s forward buffer for smooth playback.
- Try it without a TV: `npm run build:web && npm run serve:web`, open `http://localhost:8787/tv`; keyboard digits, PageUp/PageDown, arrows, Enter, Esc, `g`, `i`, `l` stand in for the remote.

### Build the APK
Requires Node 22, JDK 17 and the Android SDK (Android Studio installs it):
```bash
npm install
npm run android:apk
# -> android/app/build/outputs/apk/release/app-release.apk
```
Works on Windows, macOS and Linux. By default it builds arm64 + armv7 (phones, TV boxes, Fire TV); use `ABIS=x86_64` for an x86_64 emulator or `ABIS=all` for everything.

**Windows: keep the project path short.** The native build fails with `ninja: error: mkdir(...): No such file or directory`
when the project is in a deeply nested folder (Windows' 260-character path limit). Put the project in something like `C:\iptv`,
run `npm install` there and build. The script stops early with this advice if the path is too long.
No local Android setup? Push the project to GitHub and run **Actions → Build Android TV APK**; download the `iptv-android-tv-apk` artifact.
The APK is signed with the debug key, which is fine for sideloading; use your own keystore for the Play Store.

Install on a TV: enable Developer options → USB/Network debugging, then `adb connect <tv-ip>` and `adb install app-release.apk` (or copy it to a USB stick and open it with a file manager).

`plugins/withAndroidTV.js` makes this work: it adds the Leanback launcher + TV banner to the manifest, marks touchscreen as optional, and patches `MainActivity` to forward remote keys to JavaScript (only on TV devices).

## Features
- Browse with search, country / category / quality filters, sorting and incremental loading
- Favorites and recently watched (stored on the device)
- **My Links**: paste a single `.m3u8` stream or a whole M3U playlist URL
- Player: `expo-video` on Android/iOS (sends the per-channel User-Agent / Referer from the playlist), `hls.js` on web
- Responsive: bottom tabs on phones, sidebar on desktop, 1–3 column grid; light/dark/system theme
- Real URLs on web (`/watch/<id>`), so refresh and sharing work

## Run
For web, start the bundled server so blocked streams (CORS, plain `http://`, streams that need special headers) work:
```bash
npm install
npm run build:web
npm run serve:web    # http://localhost:8787  (static app + /proxy)
```
Dev mode with the proxy: `npm run proxy` in one terminal, `npm run web:dev` in another.
Other commands:
```bash
npm install
npm run web          # browser
npm run android      # needs Android Studio emulator or a device with Expo Go / dev build
npm run ios          # macOS + Xcode only
```
Web production build: `npm run build:web` (output in `dist/`, serve with SPA fallback to `index.html`).

## Refresh the channel list
```bash
git clone --depth 1 --branch gh-pages https://github.com/iptv-org/iptv.git iptv-pages
npm run data:build -- iptv-pages/languages
```
Or tap **Settings → Refresh from live list** in the app (loads the live Tamil and English playlists).

## Checks
```bash
npm run typecheck
```

## How playback errors are handled
- **CORS / mixed content / required headers (web):** the player tries the stream directly, then automatically retries through
  `server/server.mjs` (`/proxy`), which adds CORS headers, rewrites HLS playlists, fetches `http://` streams and sends the
  channel's User-Agent/Referer. The proxy refuses private/loopback addresses. Without the proxy, the player explains what is missing.
- **Android/iOS:** cleartext `http://` streams are allowed (`usesCleartextTraffic`, ATS), since 375 channels use plain http.
- **Failed channel:** Retry, or "Try another source" when the same channel has other links.
- Back always returns to the list (even after opening a channel directly by URL); the player is stopped before it is released.

## Notes
- Many public streams are offline, geo-blocked, or lack CORS headers. On **web** such streams fail with a clear message
  (65 channels are DASH `.mpd`, which the web player does not support); the mobile apps play more of them.
- Streams are third-party; this app hosts no content.
