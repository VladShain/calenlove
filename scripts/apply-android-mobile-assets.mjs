import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const androidRoot = path.join(root, "src-tauri", "gen", "android");
const resRoot = path.join(androidRoot, "app", "src", "main", "res");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
const assetsRoot = path.join(root, "mobile-assets", "android");

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

if (!fs.existsSync(resRoot)) {
  console.log("Android project not found yet. Run tauri android init first.");
  process.exit(0);
}

const mipmaps = ["mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"];
for (const mipmap of mipmaps) {
  copyIfExists(path.join(assetsRoot, mipmap, "ic_launcher.png"), path.join(resRoot, mipmap, "ic_launcher.png"));
  copyIfExists(path.join(assetsRoot, mipmap, "ic_launcher_round.png"), path.join(resRoot, mipmap, "ic_launcher_round.png"));
}

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf-8");
  const permissions = [
    '    <uses-permission android:name="android.permission.INTERNET" />',
    '    <uses-permission android:name="android.permission.CAMERA" />',
    '    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'
  ];

  if (!manifest.includes("android.permission.CAMERA") || !manifest.includes("android.permission.READ_MEDIA_IMAGES") || !manifest.includes("android.permission.INTERNET")) {
    const marker = "<application";
    const insertAt = manifest.indexOf(marker);
    if (insertAt !== -1) {
      const existing = new Set();
      for (const permission of permissions) {
        const nameMatch = permission.match(/android:name=\"([^\"]+)\"/);
        if (nameMatch && manifest.includes(nameMatch[1])) existing.add(permission);
      }
      const toInsert = permissions.filter((permission) => !existing.has(permission));
      if (toInsert.length > 0) {
        manifest = `${manifest.slice(0, insertAt)}${toInsert.join("\n")}\n${manifest.slice(insertAt)}`;
      }
    }
  }

  fs.writeFileSync(manifestPath, manifest, "utf-8");
}

console.log("Android mobile assets applied.");
