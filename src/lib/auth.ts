import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export interface AuthUser {
  id: string;
  loginId: string;
  name: string;
  role: string;
  wardId: string | null;
}

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me"
);

const COOKIE_NAME = "auth-token";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: user.role,
    wardId: user.wardId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return {
      id: payload.id as string,
      loginId: payload.loginId as string,
      name: payload.name as string,
      role: payload.role as string,
      wardId: (payload.wardId as string) || null,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

export async function requireCurrentUser(): Promise<{ id: string }> {
  const user = await getCurrentUser();
  if (user) return { id: user.id };

  // Fallback: first user in DB (for backwards compatibility during transition)
  const defaultUser = await prisma.user.findFirst();
  if (defaultUser) return { id: defaultUser.id };

  throw new Error("No authenticated user");
}
