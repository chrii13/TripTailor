import { describe, it, expect } from "vitest";
import { getGeminiApiKeys } from "./gemini-api-keys";

describe("getGeminiApiKeys", () => {
  it("restituisce solo la chiave primaria quando il backup non è configurato", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "primary-key";
    delete process.env.GEMINI_API_KEY_BACKUP;

    try {
      expect(getGeminiApiKeys()).toEqual(["primary-key"]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });

  it("restituisce primaria e backup, in ordine, quando entrambe sono configurate", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "primary-key";
    process.env.GEMINI_API_KEY_BACKUP = "backup-key";

    try {
      expect(getGeminiApiKeys()).toEqual(["primary-key", "backup-key"]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });

  it("scarta chiavi impostate come stringa vuota", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI_API_KEY_BACKUP = "backup-key";

    try {
      expect(getGeminiApiKeys()).toEqual(["backup-key"]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });

  it("restituisce un array vuoto quando nessuna delle due chiavi è configurata", () => {
    const originalPrimary = process.env.GEMINI_API_KEY;
    const originalBackup = process.env.GEMINI_API_KEY_BACKUP;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;

    try {
      expect(getGeminiApiKeys()).toEqual([]);
    } finally {
      if (originalPrimary === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalPrimary;
      if (originalBackup === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
      else process.env.GEMINI_API_KEY_BACKUP = originalBackup;
    }
  });
});
