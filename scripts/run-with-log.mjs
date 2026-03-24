import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [, , label = "run", rawCommand = "", ...forwardArgs] = process.argv;

if (!rawCommand) {
  console.error("Команда для run-with-log.mjs не передана");
  process.exit(1);
}

const root = process.cwd();
const logsDir = path.join(root, "logs");
fs.mkdirSync(logsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[.:]/g, "-");
const logFile = path.join(logsDir, `${label}_${stamp}.log`);
const latestFile = path.join(logsDir, `${label}_LATEST.log`);
const effectiveCommand = [rawCommand, ...forwardArgs].join(" ").trim();

const header = [
  `=== Календарь двоих ${label} ===`,
  `Старт: ${new Date().toLocaleString()}`,
  `Команда: ${effectiveCommand}`,
  `Папка: ${root}`,
  ""
].join("\n");

fs.writeFileSync(logFile, header, "utf8");
fs.writeFileSync(latestFile, header, "utf8");

const child = spawn(rawCommand, forwardArgs, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
  cwd: root,
  env: process.env
});

const writeChunk = (chunk, target) => {
  const text = chunk.toString();
  target.write(text);
  fs.appendFileSync(logFile, text);
  fs.appendFileSync(latestFile, text);
};

child.stdout.on("data", (chunk) => writeChunk(chunk, process.stdout));
child.stderr.on("data", (chunk) => writeChunk(chunk, process.stderr));

child.on("close", (code) => {
  const footer = `\n\nФиниш: ${new Date().toLocaleString()}\nКод выхода: ${code ?? 0}\n`;
  fs.appendFileSync(logFile, footer);
  fs.appendFileSync(latestFile, footer);
  process.exit(code ?? 0);
});
