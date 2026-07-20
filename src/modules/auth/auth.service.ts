import bcrypt from "bcryptjs";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import {
  getTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { ChangePasswordInput, LoginInput, RegisterInput } from "./auth.schema";

const SALT_ROUNDS = 10;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Un compte existe deja avec cet email", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email: input.email, password: hashedPassword },
  });

  return buildAuthResponse(user.id, user.role, user.email);
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError("Identifiants invalides", 401);
  }

  const isValid = await bcrypt.compare(input.password, user.password);
  if (!isValid) {
    throw new AppError("Identifiants invalides", 401);
  }

  return buildAuthResponse(user.id, user.role, user.email);
}

// Rotation du refresh token : chaque refresh invalide l'ancien et en emet un
// nouveau. Si un refresh token vole est utilise puis que le legitime essaie
// de l'utiliser apres, il aura disparu de la base -> on peut detecter et
// revoquer toute la session dans une version plus poussee.
export async function refreshAccessToken(oldRefreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError("Refresh token invalide ou expire", 401);
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError("Refresh token invalide, expire ou revoque", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError("Utilisateur introuvable", 401);
  }

  // Supprime l'ancien token (rotation) et en cree un nouveau
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });
  await storeRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
}

export async function logoutUser(refreshToken: string) {
  // Suppression silencieuse : si le token n'existe pas/deja expire, on
  // considere que l'utilisateur est deja "deconnecte", pas d'erreur necessaire.
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError("Utilisateur introuvable", 404);
  return user;
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Utilisateur introuvable", 404);

  const isValid = await bcrypt.compare(input.currentPassword, user.password);
  if (!isValid) {
    throw new AppError("Mot de passe actuel incorrect", 401);
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

  // Revoque toutes les sessions existantes : bonne pratique de securite
  // apres un changement de mot de passe (au cas ou le compte etait compromis).
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

async function buildAuthResponse(userId: string, role: string, email: string) {
  const accessToken = signAccessToken({ userId, role });
  const refreshToken = signRefreshToken({ userId, role });
  await storeRefreshToken(userId, refreshToken);

  return {
    user: { id: userId, email, role },
    accessToken,
    refreshToken,
  };
}

async function storeRefreshToken(userId: string, refreshToken: string) {
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: getTokenExpiryDate(refreshToken),
    },
  });
}
