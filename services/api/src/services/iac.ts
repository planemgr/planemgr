import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const SSH_MODULE_DIR = path.join("modules", "planemgr-ssh-platform");
const SSH_MODULE_FILENAME = "main.tf";
const SSH_MODULE_TEMPLATE = `terraform {
  required_providers {
    null = {
      source = "hashicorp/null"
    }
  }
}

variable "host" {
  type = string
}

variable "ssh_user" {
  type = string
  default = "root"
}

variable "ssh_public_key" {
  type = string
}

variable "ssh_private_key" {
  type = string
  sensitive = true
}

resource "null_resource" "provision" {
  triggers = {
    host = var.host
    public_key = var.ssh_public_key
  }

  connection {
    type = "ssh"
    host = var.host
    user = var.ssh_user
    private_key = var.ssh_private_key
  }

  provisioner "remote-exec" {
    inline = ["echo 'Planemgr SSH platform ready'"]
  }
}

output "host" {
  value = var.host
}
`;

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

const ensureSshModule = async (iacDir: string) => {
  const moduleDir = path.join(iacDir, SSH_MODULE_DIR);
  const modulePath = path.join(moduleDir, SSH_MODULE_FILENAME);
  await fs.mkdir(moduleDir, { recursive: true });
  try {
    await fs.access(modulePath);
  } catch {
    // Scaffold the module once so OpenTofu can target SSH platforms.
    await fs.writeFile(modulePath, SSH_MODULE_TEMPLATE, "utf-8");
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
  await ensureSshModule(iacDir);
};
