export function publicAssetUrl(fileName: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedFile = fileName.startsWith("/") ? fileName.slice(1) : fileName;
  return `${normalizedBase}${normalizedFile}`;
}
