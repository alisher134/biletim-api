import type { Request } from "express";
import type { PublicUser } from "../users/users.service";

export type JwtPayload = {
  sub: string;
  email: string;
};

export type RefreshTokenPayload = JwtPayload & {
  tokenVersion: number;
};

export type AuthenticatedRequest = Request & {
  user: PublicUser;
};

export type AuthTokensResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};
