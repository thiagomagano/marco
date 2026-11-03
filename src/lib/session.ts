import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken, SessionPayload } from "./auth";

const SESSION_COOKIE_NAME = "marco_session";

/**
 * Obtém a sessão do operador a partir dos cookies da requisição.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Salva a sessão nos cookies HTTP-only.
 */
export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

/**
 * Remove o cookie de sessão (Logout).
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Garante que o usuário está autenticado, retornando os dados do operador ou lançando erro.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Não autenticado");
  }
  return session;
}
