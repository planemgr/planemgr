import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const ensureCommand = (command: string, args: string[], label: string) => {
  const result = spawnSync(command, args, { stdio: "ignore" });
  if (result.error) {
    throw new Error(`${label} command not available: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} command failed to run.`);
  }
};

const ensureGitRepository = async (directory: string) => {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: directory,
    stdio: "ignore",
  });
  if (result.status === 0) {
    return;
  }
  const init = spawnSync("git", ["init", "--initial-branch=main"], {
    cwd: directory,
    stdio: "ignore",
  });
  if (init.status !== 0) {
    throw new Error("Failed to initialize git repository for IaC storage.");
  }
};

const ensureGitIdentity = (directory: string) => {
  const nameResult = spawnSync("git", ["config", "--get", "user.name"], {
    cwd: directory,
    encoding: "utf-8",
  });
  if (!nameResult.stdout?.trim()) {
    spawnSync("git", ["config", "user.name", "Plane Manager"], {
      cwd: directory,
      stdio: "ignore",
    });
  }

  const emailResult = spawnSync("git", ["config", "--get", "user.email"], {
    cwd: directory,
    encoding: "utf-8",
  });
  if (!emailResult.stdout?.trim()) {
    spawnSync("git", ["config", "user.email", "planemgr@local"], {
      cwd: directory,
      stdio: "ignore",
    });
  }
};

export const ensureIacEnvironment = async (iacDir: string) => {
  // Storage uses OpenTofu configs on disk, so validate tools and repo up front.
  ensureCommand("git", ["--version"], "git");
  ensureCommand("tofu", ["version"], "tofu");
  ensureCommand("ssh", ["-V"], "ssh");

  await fs.mkdir(path.resolve(iacDir), { recursive: true });
  await ensureGitRepository(iacDir);
  ensureGitIdentity(iacDir);
};
