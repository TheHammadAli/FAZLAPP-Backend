import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login-dto";
import { JwtAuthGuard } from "./guard/jwt-auth-guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "./strategies/jwt-strategy";
import { RefreshTokenDto } from "./dto/refreshToken-dto";
import { GoogleLoginDto } from "./dto/google-login-dto";
import { Throttle } from "@nestjs/throttler";

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";

// ✅ your custom decorators
import { Lang } from "../common/decorators/lang.decorator";
import { ApiLangHeader } from "../common/decorators/api-lang-headers.decorator";

@ApiTags("Auth")
@ApiLangHeader() // ✅ applied globally to all routes
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @ApiBearerAuth("jwt")
  @UseGuards(JwtAuthGuard)
  @Get("getCurrentUser")
  @ApiOperation({ summary: "Get the currently authenticated user" })
  @ApiResponse({ status: 200, description: "Returns user info from token" })
  getCurrentUser(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Post("login")
  @ApiOperation({ summary: "Login and get access + refresh tokens" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: "User successfully logged in" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  loginUser(@Body() loginDto: LoginDto) {
    return this.authService.loginUser(loginDto);
  }

  @Post("refreshToken")
  @ApiOperation({ summary: "Refresh JWT using refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: "New access and refresh tokens" })
  @ApiResponse({ status: 400, description: "Invalid or expired refresh token" })
  refreshToken(@Body() token: RefreshTokenDto) {
    return this.authService.refreshTokens(token);
  }

  // === Send OTP ===
  @Post("send-otp")
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @ApiOperation({ summary: "Send OTP to phone number" })
  @ApiBody({
    schema: {
      properties: { phoneNumber: { type: "string" } },
      required: ["phoneNumber"],
    },
  })
  @ApiResponse({ status: 200, description: "OTP sent successfully" })
  async sendOtp(@Body("phoneNumber") phoneNumber: string) {
    await this.authService.sendOtp(phoneNumber);
    return { message: "OTP sent successfully" };
  }

  // === Verify OTP ===
  @Post("verify-otp")
  @ApiOperation({ summary: "Verify OTP code" })
  @ApiBody({
    schema: {
      properties: {
        phoneNumber: { type: "string" },
        code: { type: "string" },
      },
      required: ["phoneNumber", "code"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "OTP verification result",
    schema: { properties: { valid: { type: "boolean" } } },
  })
  async verifyOtp(@Body() body: { phoneNumber: string; code: string }) {
    const valid = await this.authService.verifyOtp(body.phoneNumber, body.code);
    return valid;
  }

  @Post("send-email-verification")
  @ApiOperation({ summary: "Send email verification link" })
  @ApiBody({
    schema: {
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  })
  @ApiResponse({ status: 200, description: "Verification link sent" })
  async sendEmailVerification(
    @Body("email") email: string,
    @Lang() lang: string,
  ) {
    const result = await this.authService.sendEmailVerificationLink(
      email,
      lang,
    );

    return { ...result };
  }

  // === Verify Email ===
  @Get("verify-email")
  @ApiOperation({ summary: "Verify email using token from link" })
  @ApiQuery({ name: "token", type: "string", required: true })
  @ApiResponse({ status: 200, description: "Email verified successfully" })
  async verifyEmail(@Query("token") token: string) {
    return this.authService.verifyEmailToken(token);
  }

  // === Forgot Password ===
  @Post("forgot-password")
  @ApiOperation({ summary: "Send forgot password link to email" })
  @ApiBody({
    schema: {
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  })
  @ApiResponse({ status: 200, description: "Reset password link sent" })
  async sendForgotPassword(@Body("email") email: string, @Lang() lang: string) {
    return this.authService.sendForgotPasswordEmail(email, lang);
  }

  // === Verify Reset Token ===
  @Get("verify-reset-token")
  @ApiOperation({ summary: "Verify reset password token" })
  @ApiQuery({ name: "token", type: "string", required: true })
  @ApiResponse({ status: 200, description: "Token is valid" })
  async verifyResetToken(@Query("token") token: string) {
    const user = await this.authService.verifyResetPasswordToken(token);
    return { valid: !!user };
  }

  // === Reset Password ===
  @Put("reset-password")
  @ApiOperation({ summary: "Reset password using token" })
  @ApiBody({
    schema: {
      properties: {
        token: { type: "string" },
        newPassword: { type: "string" },
      },
      required: ["token", "newPassword"],
    },
  })
  @ApiResponse({ status: 200, description: "Password reset successful" })
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth() { }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const payload = await this.authService.findOrCreateUserByEmail(req.user);

    return res.redirect(
      `${this.configService.get<string>(
        "FRONTEND_URL",
      )}/google/auth/success?token=${payload.accessToken}`,
    );
  }

  @Post("google/verify/token")
  @ApiOperation({ summary: "Login with Google ID token" })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({
    status: 200,
    description: "Successfully authenticated with Google",
  })
  @ApiResponse({ status: 401, description: "Invalid Google token" })
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.verifyGoogleToken(body.idToken);
  }
}
