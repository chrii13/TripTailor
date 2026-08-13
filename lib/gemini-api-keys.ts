export function getGeminiApiKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP].filter(
    (key): key is string => !!key
  );
}
