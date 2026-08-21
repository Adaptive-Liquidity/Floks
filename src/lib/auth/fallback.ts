export function devUserFallbackAllowed(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV !== "production" && !environment.DATABASE_URL?.trim();
}
