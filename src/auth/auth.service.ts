import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UsersService, type PublicUser } from "../users/users.service";
import type { SignInDto } from "./dto/sign-in.dto";
import type { SignUpDto } from "./dto/sign-up.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";
import type {
  AuthTokensResponse,
  JwtPayload,
  RefreshTokenPayload,
} from "./types";

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: JwtSignOptions["expiresIn"];
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: JwtSignOptions["expiresIn"];

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>("JWT_ACCESS_SECRET");
    this.accessExpiresIn = config.getOrThrow<string>(
      "JWT_ACCESS_EXPIRES_IN",
    ) as JwtSignOptions["expiresIn"];
    this.refreshSecret = config.getOrThrow<string>("JWT_REFRESH_SECRET");
    this.refreshExpiresIn = config.getOrThrow<string>(
      "JWT_REFRESH_EXPIRES_IN",
    ) as JwtSignOptions["expiresIn"];
  }

  async signUp(dto: SignUpDto): Promise<AuthTokensResponse> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    return this.createTokenPair(user);
  }

  async signIn(dto: SignInDto): Promise<AuthTokensResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const publicUser = await this.usersService.findPublicById(user.id);
    if (!publicUser) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.createTokenPair(publicUser);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        dto.refreshToken,
        { secret: this.refreshSecret },
      );
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (typeof payload.tokenVersion !== "number") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.usersService.findPublicById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.createTokenPair(user);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.usersService.revokeAllSessions(userId);
  }

  private async createTokenPair(user: PublicUser): Promise<AuthTokensResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const refreshPayload: RefreshTokenPayload = {
      ...payload,
      tokenVersion: user.tokenVersion,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
}
