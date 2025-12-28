import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Pool } from "pg";

export type SshKeyPair = {
  publicKey: string;
  privateKey: string;
};

const ensureSshKeyTable = async (pool: Pool) => {
  await pool.query(
    `create table if not exists user_ssh_keys (
      username text primary key,
      public_key text not null,
      private_key text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );
  await pool.query(
    "create index if not exists user_ssh_keys_updated_at_idx on user_ssh_keys (updated_at)"
  );
};

const generateEd25519KeyPair = async (username: string): Promise<SshKeyPair> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "planemgr-ssh-"));
  const keyPath = path.join(tempDir, "id_ed25519");
  try {
    const result = spawnSync(
      "ssh-keygen",
      ["-t", "ed25519", "-C", username, "-N", "", "-f", keyPath],
      { stdio: "ignore" }
    );
    if (result.error) {
      throw new Error(`ssh-keygen failed: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error("ssh-keygen failed to generate keys.");
    }
    const privateKey = await fs.readFile(keyPath, "utf-8");
    const publicKey = (await fs.readFile(`${keyPath}.pub`, "utf-8")).trim();
    return { publicKey, privateKey };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const getUserSshKeyPair = async (
  pool: Pool,
  username: string
): Promise<SshKeyPair | null> => {
  const result = await pool.query(
    "select public_key, private_key from user_ssh_keys where username = $1",
    [username]
  );
  if (result.rowCount === 0) {
    return null;
  }
  const row = result.rows[0] as { public_key: string; private_key: string };
  return {
    publicKey: row.public_key,
    privateKey: row.private_key
  };
};

export const ensureUserSshKeyPair = async (
  pool: Pool,
  username: string
): Promise<SshKeyPair> => {
  await ensureSshKeyTable(pool);
  const existing = await getUserSshKeyPair(pool, username);
  if (existing) {
    return existing;
  }

  // Use ssh-keygen to produce OpenSSH-format keys for provisioning.
  const generated = await generateEd25519KeyPair(username);
  const insert = await pool.query(
    `insert into user_ssh_keys (username, public_key, private_key)
     values ($1, $2, $3)
     on conflict (username) do nothing
     returning public_key, private_key`,
    [username, generated.publicKey, generated.privateKey]
  );
  if (insert.rowCount > 0) {
    const row = insert.rows[0] as { public_key: string; private_key: string };
    return {
      publicKey: row.public_key,
      privateKey: row.private_key
    };
  }
  const fallback = await getUserSshKeyPair(pool, username);
  if (fallback) {
    return fallback;
  }
  throw new Error("Failed to persist SSH keypair.");
};

// Provisioning workflows (e.g. OpenTofu) need both the public and private keys.
export const getProvisioningKeyPair = ensureUserSshKeyPair;
