import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "src/users/users.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { I18nService } from "nestjs-i18n";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "src/core/prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let userService: { findUserByEmail: jest.Mock; createUser: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    userService = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("signed-token"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { otp: {} } },
        { provide: UsersService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: I18nService, useValue: { translate: jest.fn() } },
        { provide: ClsService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("returns a full user payload for newly created Google users", async () => {
    userService.findUserByEmail.mockResolvedValue(null);
    // createUser() returns { message, data: {...user} } — not the raw user —
    // this is exactly the shape findOrCreateUserByEmail must unwrap correctly.
    userService.createUser.mockResolvedValue({
      message: "User created successfully",
      data: {
        id: "user-1",
        email: "google-user@example.com",
        roles: ["buyer"],
        location: { type: "Point", coordinates: [0, 0] },
        image: "avatar.png",
        name: "Google User",
        address: "",
        isDisabled: false,
      },
    });

    const result = await service.findOrCreateUserByEmail({
      sub: "google-sub",
      email: "google-user@example.com",
      name: "Google User",
    });

    expect(result.accessToken).toBe("signed-token");
    expect((result as any).email).toBe("google-user@example.com");
    expect((result as any).name).toBe("Google User");
    expect((result as any).refreshToken).toBeDefined();
    // The bug this guards against: sub must be the real created user's id,
    // not undefined from a mis-unwrapped {message, data} wrapper.
    expect((result as any).sub).toBe("user-1");
  });
});
