import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The local manifests use single-line string fields. Codex validates the full YAML.
function scalar(value) {
  if (value.startsWith('"')) return JSON.parse(value);
  if (value.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error("invalid quoted string");
    return value.slice(1, -1).replaceAll("''", "'");
  }
  const number =
    /^(?:[-+]?(?:[0-9]+|(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:e[-+]?[0-9]+)?|\.inf)|0o[0-7]+|0x[0-9a-f]+|\.nan)$/i;
  if (!value || /^(?:true|false|null|~)$/i.test(value) || number.test(value)) {
    throw new Error("expected a nonempty string");
  }
  if ("[]{}&*!|>#".includes(value[0]) || /:\s|\s#/.test(value)) {
    throw new Error("use a single-line quoted string");
  }
  return value;
}

export function checkSkills(directory) {
  const root = realpathSync(directory);
  const errors = [];
  const files = [];
  const names = new Set();
  const documents = new Map();
  const edges = new Map();
  const manifests = [];
  const report = (file, message) => errors.push(`${relative(root, file)}: ${message}`);
  const contained = (file) => {
    const path = relative(root, realpathSync(file));
    return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
  };

  function walk(directory) {
    if (!contained(directory)) {
      report(directory, "skill directories must stay inside the repository");
      return;
    }
    if (lstatSync(directory).isSymbolicLink()) {
      report(directory, "skill directories must not be symbolic links");
      return;
    }
    for (const entry of readdirSync(directory).sort()) {
      const file = join(directory, entry);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) report(file, "skill resources must not be symbolic links");
      else if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) files.push(file);
    }
  }

  const skills = join(root, ".agents/skills");
  try {
    walk(skills);
  } catch (error) {
    report(skills, error.message);
  }

  let scripts = {};
  try {
    scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
  } catch (error) {
    report(join(root, "package.json"), error.message);
  }

  for (const file of files.filter((path) => path.endsWith(".md"))) {
    const text = readFileSync(file, "utf8");
    documents.set(file, text);
    edges.set(file, []);
    if (basename(file) !== "SKILL.md") continue;
    manifests.push(file);
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (!match) {
      report(file, "missing YAML frontmatter");
      continue;
    }
    const fields = {};
    for (const key of ["name", "description"]) {
      const values = [...match[1].matchAll(new RegExp(`^${key}: *(.*)$`, "gm"))];
      try {
        if (values.length !== 1) throw new Error("expected exactly one field");
        fields[key] = scalar(values[0][1].trim());
        if (typeof fields[key] !== "string" || !fields[key].trim()) {
          throw new Error("expected a nonempty string");
        }
      } catch (error) {
        report(file, `${key}: ${error.message}`);
      }
    }
    if (fields.name) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.name) || fields.name.length > 64) {
        report(file, "invalid skill name");
      }
      if (basename(resolve(file, "..")) !== fields.name) report(file, "folder and name differ");
      if (names.has(fields.name)) report(file, "duplicate skill name");
      names.add(fields.name);
    }
    if (
      fields.description &&
      (fields.description.length > 1024 || /[<>]/.test(fields.description))
    ) {
      report(file, "invalid description");
    }
  }

  for (const [file, text] of documents) {
    for (const [, path] of text.matchAll(/`@([^`\s]+)`/g)) {
      // @path describes the notation rather than naming a resource.
      if (path === "path") continue;
      const target = resolve(root, path);
      try {
        if (isAbsolute(path) || path.split(/[\\/]/).includes("..") || !contained(target)) {
          throw new Error("reference must stay inside the repository");
        }
        if (!lstatSync(target).isFile()) throw new Error("reference must name a file");
        edges.get(file).push(target);
      } catch (error) {
        report(file, `@${path}: ${error.message}`);
      }
    }
    for (const [, command] of text.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g)) {
      if (!Object.hasOwn(scripts, command)) report(file, `missing npm script: ${command}`);
    }
  }

  const reached = new Set();
  function visit(file) {
    if (reached.has(file)) return;
    reached.add(file);
    for (const target of edges.get(file) ?? []) visit(target);
  }
  for (const file of manifests) visit(file);
  for (const file of documents.keys()) {
    if (!reached.has(file)) report(file, "reference document is unreachable from SKILL.md");
  }
  if (!manifests.length) report(skills, "no SKILL.md found");
  return { skills: manifests.length, references: [...edges.values()].flat().length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkSkills(process.argv[2] ?? process.cwd());
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
