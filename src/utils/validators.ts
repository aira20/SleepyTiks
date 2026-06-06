export function isValidDiscordId(id: string): boolean {
  return /^\d{17,20}$/.test(id);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>@#&]/g, '').trim();
}
