export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // karakter "/" ikut kena, otomatis jadi "-"
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function dedupeSlug(baseSlug: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(baseSlug)) return baseSlug;
  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  while (existingSlugs.has(candidate)) {
    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
  return candidate;
}
