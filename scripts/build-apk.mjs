// Cross-platform release-APK build (Windows / macOS / Linux).
//   npm run android:apk                 -> arm64 + armv7 (real phones, TV boxes, Fire TV)
//   ABIS=x86_64 npm run android:apk     -> for an x86_64 emulator
//   ABIS=all npm run android:apk        -> every ABI (slower, larger APK)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const win = process.platform === 'win32';

// Windows limits paths to 260 chars and the native (CMake/ninja) build embeds the full project path
// in every object-file path, so a deeply nested project fails with "ninja: error: mkdir(...)".
// Measured: the longest native object path is about 2 x (project path length) + 176 characters; the limit is 260.
const TOO_LONG = win && root.length > 40;
if (TOO_LONG && !process.env.ALLOW_LONG_PATH) {
  console.error(`
The project path is too long for the Android native build on Windows (${root.length} characters):
  ${root}

Move the project to a SHORT folder, for example  C:\\iptv  , run "npm install" there, and build again.
(Enabling Windows "LongPathsEnabled" often is not enough because the SDK's ninja/cmake ignore it.)
To try anyway:  set ALLOW_LONG_PATH=1
`);
  process.exit(1);
}

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}   (in ${cwd})`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win });
  if (r.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args[0] ?? ''} (exit ${r.status ?? r.signal})`);
    if (TOO_LONG) {
      console.error(`\nMost likely cause: the project path is too long for Windows (${root.length} chars, max about 40).\nMove the project to a short folder such as C:\\iptv, run "npm install" there, and build again.`);
    }
    process.exit(r.status || 1);
  }
}

const abis = process.env.ABIS === 'all' ? null : process.env.ABIS || 'arm64-v8a,armeabi-v7a';

run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], root);

const androidDir = path.join(root, 'android');
const gradle = win ? 'gradlew.bat' : './gradlew';
run(gradle, ['assembleRelease', ...(abis ? [`-PreactNativeArchitectures=${abis}`] : [])], androidDir);

const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apk)) {
  console.error('Build finished but the APK was not found at ' + apk);
  process.exit(1);
}
console.log(`\nAPK ready (${(fs.statSync(apk).size / 1048576).toFixed(1)} MB):\n  ${apk}`);
