import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkSkills } from "./check-skills.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "skills-check-"));
  function write(path: string, content: string) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  write("package.json", JSON.stringify({ scripts: { verify: "node verify.mjs" } }));
  write("AGENTS.md", "# Constraints\n");
  write(
    ".agents/skills/example/SKILL.md",
    "---\nname: example\ndescription: Check a fixture.\n---\n\nOpen `@AGENTS.md`.\nRead `@.agents/skills/example/references/check.md`.\n",
  );
  write(".agents/skills/example/references/check.md", "# Check\n\nnpm run verify\n");
  return { root, write };
}

describe("skill structure validation", () => {
  it("accepts discoverable metadata, references and commands without changing files", () => {
    const { root } = fixture();
    const file = join(root, ".agents/skills/example/SKILL.md");
    const before = readFileSync(file, "utf8");
    expect(checkSkills(root)).toEqual({ skills: 1, references: 2, errors: [] });
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it.each([
    ["missing frontmatter", "# No metadata", "missing YAML frontmatter"],
    [
      "duplicate field",
      "---\nname: example\nname: example\ndescription: Check\n---\n",
      "exactly one field",
    ],
    ["non-string field", "---\nname: example\ndescription: false\n---\n", "nonempty string"],
    ["invalid name", "---\nname: Example\ndescription: Check\n---\n", "invalid skill name"],
    [
      "folder mismatch",
      "---\nname: different\ndescription: Check\n---\n",
      "folder and name differ",
    ],
  ])("rejects %s", (_label, content, message) => {
    const { root, write } = fixture();
    write(".agents/skills/example/SKILL.md", content);
    expect(checkSkills(root).errors.join("\n")).toContain(message);
  });

  it("rejects duplicate names discovered at different depths", () => {
    const { root, write } = fixture();
    write(
      ".agents/skills/group/example/SKILL.md",
      "---\nname: example\ndescription: Another skill\n---\n",
    );
    expect(checkSkills(root).errors.join("\n")).toContain("duplicate skill name");
  });

  it.each(["0x10", "0o17", "1e3", "+1.0e-2", ".inf", "-.Inf", ".NaN", "0", "null", "~", "true"])(
    "rejects the non-string YAML scalar %s while accepting its quoted form",
    (value) => {
      const { root, write } = fixture();
      const content = readFileSync(join(root, ".agents/skills/example/SKILL.md"), "utf8");
      write(".agents/skills/example/SKILL.md", content.replace("Check a fixture.", value));
      expect(checkSkills(root).errors.join("\n")).toContain("nonempty string");
      write(
        ".agents/skills/example/SKILL.md",
        content.replace("Check a fixture.", JSON.stringify(value)),
      );
      expect(checkSkills(root).errors).toEqual([]);
    },
  );

  it("rejects missing references, unknown commands and unreachable documents", () => {
    const { root, write } = fixture();
    write(".agents/skills/example/references/check.md", "Read `@missing.md`.\nnpm run missing\n");
    write(".agents/skills/example/references/orphan.md", "# Unlinked\n");
    const errors = checkSkills(root).errors.join("\n");
    expect(errors).toContain("@missing.md");
    expect(errors).toContain("missing npm script: missing");
    expect(errors).toContain("unreachable");
  });

  it("rejects traversal and symlinks to files outside the repository", () => {
    const { root, write } = fixture();
    const outside = mkdtempSync(join(tmpdir(), "skills-outside-"));
    writeFileSync(join(outside, "external.md"), "# External\n");
    symlinkSync(join(outside, "external.md"), join(root, "external.md"));
    write(
      ".agents/skills/example/references/check.md",
      "Read `@../outside.md` and `@external.md`.\n",
    );
    expect(
      checkSkills(root).errors.filter((message: string) =>
        message.includes("inside the repository"),
      ),
    ).toHaveLength(2);
  });

  it("fails when no skill is discovered", () => {
    const root = mkdtempSync(join(tmpdir(), "skills-empty-"));
    writeFileSync(join(root, "package.json"), "{}");
    expect(checkSkills(root).errors.join("\n")).toContain("no SKILL.md found");
  });

  it("returns success or failure through the CLI and reports JSON", () => {
    const { root, write } = fixture();
    const script = fileURLToPath(new URL("check-skills.mjs", import.meta.url));
    const valid = spawnSync(process.execPath, [script, root], { encoding: "utf8" });
    expect(valid.status).toBe(0);
    expect(JSON.parse(valid.stdout).errors).toEqual([]);
    write(".agents/skills/example/references/check.md", "Read `@missing.md`.\n");
    const invalid = spawnSync(process.execPath, [script, root], { encoding: "utf8" });
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout).errors.length).toBeGreaterThan(0);
  });
});
