// lib/auth.ts — Admin authentication helpers

export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD env var is not set!');
    return false;
  }
  return password === adminPassword;
}

export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return Response.json({ error: message }, { status: 401 });
}
