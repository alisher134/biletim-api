import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";

jest.mock("@nestjs/config", () => ({
  ConfigService: class ConfigService {},
}));

jest.mock("@nestjs/jwt", () => ({
  JwtService: class JwtService {},
}));

jest.mock("argon2", () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hash:${password}`)),
  verify: jest.fn((hash: string, password: string) =>
    Promise.resolve(hash === `hash:${password}`),
  ),
}));

const publicUser = {
  id: "user-1",
  email: "a@b.com",
  firstName: "Alisher",
  lastName: "Test",
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("AuthService", () => {
  let service: AuthService;
  const usersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findPublicById: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    jwtService.signAsync.mockImplementation(
      (_payload: unknown, options?: { secret?: string }) =>
        Promise.resolve(
          options?.secret === "refresh-secret"
            ? "refresh-token"
            : "access-token",
        ),
    );
    usersService.create.mockResolvedValue(publicUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const values: Record<string, string> = {
                JWT_ACCESS_SECRET: "access-secret",
                JWT_ACCESS_EXPIRES_IN: "15m",
                JWT_REFRESH_SECRET: "refresh-secret",
                JWT_REFRESH_EXPIRES_IN: "7d",
              };
              return values[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    jwtService.signAsync.mockImplementation(
      (_payload: unknown, options?: { secret?: string }) =>
        Promise.resolve(
          options?.secret === "refresh-secret"
            ? "refresh-token"
            : "access-token",
        ),
    );
  });

  it("signs up a user and returns a token pair", async () => {
    const result = await service.signUp({
      email: "A@B.com",
      password: "password1",
      firstName: "Alisher",
      lastName: "Test",
    });

    expect(usersService.create).toHaveBeenCalledWith({
      email: "a@b.com",
      passwordHash: "hash:password1",
      firstName: "Alisher",
      lastName: "Test",
    });
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.user.email).toBe("a@b.com");
  });

  it("signs in a user and returns a token pair", async () => {
    usersService.findByEmail.mockResolvedValue({
      ...publicUser,
      passwordHash: "hash:password1",
    });

    const result = await service.signIn({
      email: "a@b.com",
      password: "password1",
    });

    expect(result.accessToken).toBe("access-token");
    expect(result.user.email).toBe("a@b.com");
  });

  it("throws UnauthorizedException when the user does not exist", async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.signIn({ email: "missing@b.com", password: "password1" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the password does not match", async () => {
    usersService.findByEmail.mockResolvedValue({
      ...publicUser,
      passwordHash: "hash:other",
    });

    await expect(
      service.signIn({ email: "a@b.com", password: "password1" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("issues a new token pair from a valid refresh token", async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-1",
      email: "a@b.com",
    });
    usersService.findPublicById.mockResolvedValue(publicUser);

    const result = await service.refresh({ refreshToken: "refresh-token" });

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
  });

  it("throws UnauthorizedException when the refresh token is invalid", async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error("invalid token"));

    await expect(
      service.refresh({ refreshToken: "bad-token" }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
