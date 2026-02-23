import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SALT_LEN = 32;

function keyFromPassphrase(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN);
}

export function encrypt(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = keyFromPassphrase(passphrase, salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]);
}

export function decrypt(blob: Buffer, passphrase: string): Buffer {
  const salt = blob.subarray(0, SALT_LEN);
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const enc = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = keyFromPassphrase(passphrase, salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}
