// Zap Komunick: public delivery must never resolve a private or ambiguous path.
export function publicFileRelativePath(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 4096 ||
    /[\\:]/.test(value) ||
    Array.from(value).some(character => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    return undefined;
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === ".."))
    return undefined;
  return value;
}
