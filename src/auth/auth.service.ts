import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "src/users/users.service";
import { LoginDto } from "./dto/login-dto";
import { JwtService } from "@nestjs/jwt";
import { RefreshTokenDto } from "./dto/refreshToken-dto";
import { Twilio } from "twilio";
import { ConfigService } from "@nestjs/config";
import { I18nService } from "nestjs-i18n";
import * as crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "src/core/prisma/prisma.service";
@Injectable()
export class AuthService {
  private twilioClient: Twilio;
  private googleClient: OAuth2Client;
  private audience: string[];
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService, // ✅ Add this
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) {
    this.googleClient = new OAuth2Client();
    // this.twilioClient = new Twilio(
    //   this.configService.get('TWILIO_ACCOUNT_SID'),
    //   this.configService.get('TWILIO_AUTH_TOKEN')
    // );
  }

  private getLang(): string {
    return this.cls.get("lang") || "en";
  }

  async loginUser(loginDto: LoginDto) {
    const user = await this.userService.validateUserForLogin(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.invalid_credentials", {
          lang: this.getLang(),
        }),
      );
    }

    if (user.isDisabled) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.account_disabled", {
          lang: this.getLang(),
        }),
      );
    }

    const payload = {
      sub: user.id, // or user.id
      email: user.email,
      roles: user.roles, // if you have roles
      location: user.location,
      image: user.image,
      isDisabled: user.isDisabled,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: "1d",
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: "3d",
    });

    // Save refresh token in DB (optionally hashed)
    await this.userService.updateUser(user.id, { refreshToken });

    return {
      message: this.i18n.translate("auth.auth.login_success", {
        lang: this.getLang(),
      }),
      data: {
        refreshToken,
        accessToken,
        user,
      },
    };
  }

  async refreshTokens(refreshToken: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshToken.token); // Verifies expiration and signature

      const user = await this.userService.findByIdWithToken(payload.sub);

      if (!user || user.refreshToken !== refreshToken.token) {
        throw new UnauthorizedException(
          this.i18n.translate("auth.auth.refresh_token_invalid", {
            lang: this.getLang(),
          }),
        );
      }

      const newPayload = {
        sub: (user as any).id, // Or user.id if you’ve transformed it
        email: user.email,
        roles: user.roles,
        location: user.location,
        image: user.image,
        isDisabled: user.isDisabled,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: "1d",
      });

      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: "3d",
      });

      await this.userService.updateUser(user.id, {
        refreshToken: newRefreshToken,
      });

      return {
        message: this.i18n.translate("auth.auth.refresh_token_success", {
          lang: this.getLang(),
        }),
        data: {
          accessToken: newAccessToken,
          user,
          refreshToken: refreshToken.token
        }
      };
    } catch (err) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.refresh_token_invalid", {
          lang: this.getLang(),
        }),
      );
    }
  }
  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userService.findByIdWithToken(payload.sub);

      if (!user) throw new UnauthorizedException();

      // Invalidate refresh token in DB
      await this.userService.updateUser(user.id, { refreshToken: null });

      return {
        message: this.i18n.translate("auth.auth.logout_success", {
          lang: this.getLang(),
        }),
      };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async sendOtp(phoneNumber: string): Promise<void> {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    // await this.twilioClient.messages.create({
    //   body: `Your verification code is: ${otpCode}`,
    //   from: this.configService.get('TWILIO_PHONE_NUMBER'),
    //   to: phoneNumber,
    // });

    // Upsert OTP in DB (no unique constraint on phoneNumber, so this is a
    // manual find-then-update-or-create, matching Mongoose's upsert:true)
    const data = {
      phoneNumber,
      code: otpCode,
      createdAt: new Date(),
      type: "phone",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins expiration
    };

    const existing = await this.prisma.otp.findFirst({ where: { phoneNumber } });
    if (existing) {
      await this.prisma.otp.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.otp.create({ data });
    }
  }

  async sendEmailVerificationLink(email: string, lang: string = "en") {
    // Generate a token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Upsert OTP for email verification
    const data = {
      email,
      code: token,
      type: "email_verification",
      createdAt: new Date(),
      expiresAt: expires,
    };

    const existing = await this.prisma.otp.findFirst({
      where: { email, type: "email_verification" },
    });
    if (existing) {
      await this.prisma.otp.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.otp.create({ data });
    }

    return {
      data: token,
      message: this.i18n.translate("auth.auth.verification_email_sent", {
        lang: this.getLang(),
      }),
    };
  }
  async verifyEmailToken(token: string) {
    // Find OTP record for email verification
    const record = await this.prisma.otp.findFirst({
      where: { code: token, type: "email_verification" },
    });
    if (!record) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.google_verification_failed", {
          lang: this.getLang(),
        }),
      );
    }

    // Check expiration
    const isExpired =
      (record.expiresAt && record.expiresAt < new Date()) ||
      (record.createdAt &&
        new Date().getTime() - new Date(record.createdAt).getTime() >
        24 * 60 * 60 * 1000);
    if (isExpired) {
      await this.prisma.otp.deleteMany({
        where: { code: token, type: "email_verification" },
      });
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.verification_token_expired", {
          lang: this.getLang(),
        }),
      );
    }

    // Optionally, delete the token after verification
    await this.prisma.otp.deleteMany({
      where: { code: token, type: "email_verification" },
    });

    return {
      email: record.email,
      message: this.i18n.translate("auth.auth.email_verified", {
        lang: this.getLang(),
      }),
    };
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const lang = this.cls.get("lang") || "en";
    const record = await this.prisma.otp.findFirst({ where: { phoneNumber } });

    if (!record) return { message: this.i18n.translate("auth.auth.otp_not_found", { lang }), data: { isValid: false } };

    // Check expiration (5 mins window)
    const isExpired =
      new Date().getTime() - new Date(record.createdAt).getTime() >
      5 * 60 * 1000;
    if (isExpired) {
      await this.prisma.otp.deleteMany({ where: { phoneNumber } }); // Delete expired OTP
      return { message: this.i18n.translate("auth.auth.otp_expired", { lang }), data: { isValid: false } };
    }

    const isValid = record.code === code;

    if (isValid) {
      await this.prisma.otp.deleteMany({ where: { phoneNumber } }); // Delete OTP after successful verification
    }

    return { message: this.i18n.translate("auth.auth.otp_verified", { lang: this.getLang() }), data: { isValid } };
  }

  async sendForgotPasswordEmail(email: string, lang: string = "en") {
    const user = await this.userService.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.email_not_found", {
          lang: this.getLang(),
        }),
      );
    }
    // Generate token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token and expiry to user
    await this.userService.updateUser(user.id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });

    // Send email (adjust URL as needed)

    // await this.mailerService.sendMail({
    //   to: user.email,
    //   subject: 'Reset your password',
    //   template: './reset-password', // e.g. src/templates/reset-password.hbs
    //   context: { name: user.name, resetUrl },
    // });

    return {
      message: this.i18n.translate("auth.auth.reset_link_sent", { lang }),
      data: token,
    };
  }

  async verifyResetPasswordToken(token: string) {
    const user = await this.userService.findByResetToken(token);
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.invalid_reset_token", {
          lang: this.getLang(),
        }),
      );
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.reset_token_expired", {
          lang: this.getLang(),
        }),
      );
    }
    return user;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.verifyResetPasswordToken(token);
    await this.userService.updateUser(user.id, {
      password: newPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });
    return {
      message: this.i18n.translate("auth.auth.password_reset_success", {
        lang: this.getLang(),
      }),
    };
  }

  async findOrCreateUserByEmail(payload: {
    sub: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }): Promise<{ accessToken: string; returnPayload: any }> {
    // Check if user exists
    const user = await this.userService.findUserByEmail(payload.email);
    let returnPayload: any = {};
    if (!user) {
      // Create new user
      const createResult = await this.userService.createUser({
        email: payload.email,
        // Add any other default fields as needed
        provider: "google", // or set based on your logic
        password: "",
        name:
          payload.firstName && payload.lastName
            ? `${payload.firstName} ${payload.lastName}`
            : payload.name
              ? payload.name
              : "",
        address: "",
        roles: ["buyer"],
        language: "en",
        isVerified: false,
        location: {
          type: "Point",
          coordinates: [0, 0], // Default coordinates, adjust as needed
        },
        image: null,
      } as any);

      // createUser() returns { message, data: {...user} }, not the raw user
      const newUser = (createResult as any).data;

      const refreshToken = this.jwtService.sign({}, { expiresIn: "3d" });
      returnPayload = {
        ...newUser,
        sub: newUser.id,
        refreshToken,
      };
    } else {
      returnPayload = { ...(user as any), sub: (user as any).id };
    }

    const accessToken = this.jwtService.sign(returnPayload, {
      expiresIn: "1d",
    });

    return {
      accessToken,
      ...returnPayload,
    };
  }
  createJwtToken(payload: any) {
    return this.jwtService.sign(payload, {
      expiresIn: "10h",
    });
  }

  async verifyGoogleToken(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: [
          this.configService.get<string>("GOOGLE_CLIENT_ID"),
          this.configService.get<string>("GOOGLE_CLIENT_ID_ANDROID"),
          this.configService.get<string>("GOOGLE_CLIENT_ID_IOS"),
        ].filter((value): value is string => Boolean(value)),
      });

      const payload = ticket.getPayload();

      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!payload) {
        throw new UnauthorizedException("Invalid Google token");
      }

      const user = await this.findOrCreateUserByEmail({
        sub: payload["sub"],
        email: payload["email"] as string,
        firstName: payload["given_name"],
        lastName: payload["family_name"],
        name: payload["name"],
      });


      return { user, accessToken: user.accessToken };
    } catch (err) {
      console.error("Error verifying Google ID token:", err);
      throw new UnauthorizedException(
        this.i18n.translate("auth.auth.google_verification_failed", {
          lang: this.getLang(),
        }),
      );
    }
  }
}
