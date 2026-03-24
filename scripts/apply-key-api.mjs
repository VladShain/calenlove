import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const keyApiCandidates = [
  path.join(root, "KEY_API"),
  path.join(root, "KEY_API.txt")
];
const keyApiPath = keyApiCandidates.find((candidate) => fs.existsSync(candidate));
const envLocalPath = path.join(root, ".env.local");

function parseKeyApi(text) {
  const data = {};
  const cleanText = text.replace(/^\uFEFF/, "");
  for (const rawLine of cleanText.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^\uFEFF/, "");
    if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("//")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim().replace(/^\uFEFF/, "");
    const value = line.slice(eqIndex + 1).trim();
    if (!key) continue;
    data[key] = value;
  }
  return data;
}

if (!keyApiPath) {
  console.log("[KEY_API] Файл KEY_API не найден. Пропускаю обновление .env.local.");
  process.exit(0);
}

const parsed = parseKeyApi(fs.readFileSync(keyApiPath, "utf8"));
const cloudMode = parsed.VITE_SUPABASE_URL && parsed.VITE_SUPABASE_ANON_KEY ? "cloud" : "local";
const lines = [
  `VITE_SUPABASE_URL=${parsed.VITE_SUPABASE_URL || ""}`,
  `VITE_SUPABASE_ANON_KEY=${parsed.VITE_SUPABASE_ANON_KEY || ""}`,
  `VITE_SUPABASE_BUCKET=${parsed.VITE_SUPABASE_BUCKET || "calendar-media"}`,
  `VITE_CLOUD_MODE=${cloudMode}`,
  `VITE_SERVER_PUBLIC_URL=${parsed.SERVER_PUBLIC_URL || ""}`
];

fs.writeFileSync(envLocalPath, lines.join("\n") + "\n", "utf8");
console.log(`[KEY_API] .env.local обновлён из ${path.basename(keyApiPath)} (${cloudMode})`);
