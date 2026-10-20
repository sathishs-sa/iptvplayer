/**
 * Expo config plugin: makes the Android build installable and usable on Android TV.
 *  1. Manifest: Leanback launcher entry, TV banner, touchscreen/leanback marked optional (so phones still install it)
 *  2. MainActivity: forwards TV remote keys (0-9, channel +/-, page up/down, guide, info, last channel and the
 *     D-pad arrows) to JavaScript as the "tvRemoteKey" device event. Only active on TV devices.
 *  3. Copies the TV banner image into the drawable resources.
 * The edits are idempotent, so running prebuild repeatedly is safe.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withMainActivity, withDangerousMod } = require('expo/config-plugins');

const FEATURES = [
  { name: 'android.software.leanback', required: 'false' },
  { name: 'android.hardware.touchscreen', required: 'false' },
];

function withTvManifest(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;

    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    for (const f of FEATURES) {
      if (!manifest['uses-feature'].some((u) => u.$['android:name'] === f.name)) {
        manifest['uses-feature'].push({ $: { 'android:name': f.name, 'android:required': f.required } });
      }
    }

    const app = manifest.application[0];
    app.$['android:banner'] = '@drawable/tv_banner';

    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    const launcher = (main['intent-filter'] ?? []).find((i) =>
      (i.action ?? []).some((a) => a.$['android:name'] === 'android.intent.action.MAIN'),
    );
    if (launcher) {
      launcher.category = launcher.category ?? [];
      if (!launcher.category.some((x) => x.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
        launcher.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
      }
    }
    return c;
  });
}

const KOTLIN_IMPORTS = [
  'import android.content.res.Configuration',
  'import android.view.KeyEvent',
  'import com.facebook.react.ReactApplication',
  'import com.facebook.react.bridge.Arguments',
  'import com.facebook.react.modules.core.DeviceEventManagerModule',
];

const KOTLIN_BODY = `
  // ---- Android TV remote support (added by plugins/withAndroidTV.js) ----
  private fun isTelevision(): Boolean =
    (resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK) == Configuration.UI_MODE_TYPE_TELEVISION

  /** Returns the JS key name, or null when the key is not one we forward. */
  private fun remoteKeyName(code: Int): String? = when (code) {
    KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_NUMPAD_0 -> "0"
    KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_NUMPAD_1 -> "1"
    KeyEvent.KEYCODE_2, KeyEvent.KEYCODE_NUMPAD_2 -> "2"
    KeyEvent.KEYCODE_3, KeyEvent.KEYCODE_NUMPAD_3 -> "3"
    KeyEvent.KEYCODE_4, KeyEvent.KEYCODE_NUMPAD_4 -> "4"
    KeyEvent.KEYCODE_5, KeyEvent.KEYCODE_NUMPAD_5 -> "5"
    KeyEvent.KEYCODE_6, KeyEvent.KEYCODE_NUMPAD_6 -> "6"
    KeyEvent.KEYCODE_7, KeyEvent.KEYCODE_NUMPAD_7 -> "7"
    KeyEvent.KEYCODE_8, KeyEvent.KEYCODE_NUMPAD_8 -> "8"
    KeyEvent.KEYCODE_9, KeyEvent.KEYCODE_NUMPAD_9 -> "9"
    KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP, KeyEvent.KEYCODE_MEDIA_NEXT -> "channelUp"
    KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN, KeyEvent.KEYCODE_MEDIA_PREVIOUS -> "channelDown"
    KeyEvent.KEYCODE_LAST_CHANNEL -> "last"
    KeyEvent.KEYCODE_INFO -> "info"
    KeyEvent.KEYCODE_GUIDE, KeyEvent.KEYCODE_MENU -> "guide"
    KeyEvent.KEYCODE_DPAD_UP -> "up"
    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
    else -> null
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (!isTelevision()) return super.dispatchKeyEvent(event)
    val name = remoteKeyName(event.keyCode) ?: return super.dispatchKeyEvent(event)
    val isDpad = name == "up" || name == "down" || name == "left" || name == "right"

    if (event.action == KeyEvent.ACTION_DOWN) {
      try {
        val ctx = (application as ReactApplication).reactHost?.currentReactContext
        ctx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit(
          "tvRemoteKey",
          Arguments.createMap().apply {
            putString("key", name)
            putInt("repeat", event.repeatCount)
          }
        )
      } catch (e: Exception) {
        // never let a JS-bridge hiccup break key handling
      }
    }
    // D-pad keys are still delivered to the focus system (menus, lists); the other keys are consumed here.
    return if (isDpad) super.dispatchKeyEvent(event) else true
  }
`;

function withTvMainActivity(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes('tvRemoteKey')) return c; // already patched
    if (c.modResults.language !== 'kt') throw new Error('withAndroidTV: expected a Kotlin MainActivity');

    const missing = KOTLIN_IMPORTS.filter((i) => !src.includes(i));
    src = src.replace(/(import android\.os\.Bundle\s*\n)/, `$1${missing.join('\n')}\n`);
    const end = src.lastIndexOf('}');
    src = src.slice(0, end) + KOTLIN_BODY + '}\n';
    c.modResults.contents = src;
    return c;
  });
}

function withTvBanner(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const from = path.join(c.modRequest.projectRoot, 'assets', 'tv-banner.png');
      const toDir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable-xhdpi');
      fs.mkdirSync(toDir, { recursive: true });
      fs.copyFileSync(from, path.join(toDir, 'tv_banner.png'));
      return c;
    },
  ]);
}

module.exports = (config) => withTvBanner(withTvMainActivity(withTvManifest(config)));
