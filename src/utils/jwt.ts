import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.accessExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.refreshExpiresIn as SignOptions["expiresIn"],
  };
  // jti (JWT ID) aleatoire : sans ca, deux refresh tokens emis pour le meme
  // user a la meme seconde seraient des chaines strictement identiques
  // (JWT deterministe pour un meme payload+iat+exp), ce qui viole la
  // contrainte d'unicite en base. Ca arrive surtout dans des tests rapides,
  // mais aussi si un client relance vite deux logins.
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}

// Extrait la date d'expiration d'un token deja signe, pour la stocker en base
// a cote du refresh token (necessaire pour le nettoyage / la revocation).
export function getTokenExpiryDate(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) {
    throw new Error("Impossible de decoder l'expiration du token");
  }
  return new Date(decoded.exp * 1000);
}
