import { ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  let service: UsersService;
  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  it("creates a user without returning passwordHash", async () => {
    const created = {
      id: "1",
      email: "a@b.com",
    };
    prisma.user.create.mockResolvedValue(created);

    await expect(service.create("a@b.com", "hash")).resolves.toMatchObject({
      email: "a@b.com",
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: "a@b.com", passwordHash: "hash" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("throws ConflictException when email already exists", async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(service.create("a@b.com", "hash")).rejects.toThrow(
      ConflictException,
    );
  });
});
