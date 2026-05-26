import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const faq = JSON.parse(fs.readFileSync(path.join(root, "src/content/faq.json"), "utf8"));

const readmes = [
  { file: "README.md", language: "en" },
  { file: "README.zh-CN.md", language: "zh-CN" }
];

for (const { file, language } of readmes) {
  const readmePath = path.join(root, file);
  const original = fs.readFileSync(readmePath, "utf8");
  const section = renderFaqSection(faq.duplicateDevices[language]);
  const updated = original.replace(/## Q&A\r?\n[\s\S]*?(?=\r?\n## )/, section);

  if (updated === original) {
    continue;
  }

  fs.writeFileSync(readmePath, updated, "utf8");
  console.log(`Updated ${file}`);
}

function renderFaqSection(item) {
  return ["## Q&A", "", `### ${item.question}`, "", ...item.answer.flatMap((paragraph) => [paragraph, ""])]
    .join("\n")
    .trimEnd();
}
