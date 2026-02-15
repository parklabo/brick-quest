export function isValidBase64Image(data: string): boolean {
  return /^[A-Za-z0-9+/=]+$/.test(data) && data.length > 100;
}

export function isValidJobId(id: string): boolean {
  return /^[a-f0-9-]{36}$/.test(id) || /^[a-z0-9]+$/.test(id);
}
