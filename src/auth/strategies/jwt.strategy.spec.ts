import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "../../users/users.service";
import { JwtStrategy } from "./jwt.strategy";

jest.mock("@nestjs/config", () => ({
  ConfigService: class ConfigService {},
}));

jest.mock("@nestjs/passport", () => ({
  PassportStrategy: () =>
    class MockPassportStrategy {
      constructor() {}
    },
}));

jest.mock("passport-jwt", () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn(),
  },
  Strategy: class Strategy {},
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

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  const usersService = {
    findPublicById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === "JWT_ACCESS_SECRET") {
                return "access-secret";
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    jest.clearAllMocks();
  });

  it("returns the public user when the token subject exists", async () => {
    usersService.findPublicById.mockResolvedValue(publicUser);

    await expect(
      strategy.validate({ sub: "user-1", email: "a@b.com" }),
    ).resolves.toEqual(publicUser);
    expect(usersService.findPublicById).toHaveBeenCalledWith("user-1");
  });

  it("throws UnauthorizedException when the user does not exist", async () => {
    usersService.findPublicById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: "missing", email: "a@b.com" }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
