import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUpdateUserDto } from "./dto/create-update-User.dto";
import { JwtAuthGuard } from "src/auth/guard/jwt-auth-guard";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
  ApiResponse,
} from "@nestjs/swagger";
import { Public } from "src/common/decorators/public.decorator";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { UpdateUserDto } from "./dto/update-user.dto";
import { create } from "domain";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { JwtPayload } from "src/auth/strategies/jwt-strategy";

@ApiTags("Users")
@ApiBearerAuth("jwt")
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Public()
  @Post("createUser")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Create a new user (public)" })
  @ApiBody({ type: CreateUpdateUserDto })
  @UseInterceptors(FileFieldsInterceptor([{ name: "image", maxCount: 1 }]))
  @ApiBearerAuth(undefined) // 👈 This hides the lock icon and Bearer field in Swagger
  async createUser(
    @Body() createUserDto: CreateUpdateUserDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
    },
  ) {
    if (files?.image && files.image.length > 0) {
      createUserDto.image = files.image[0];
    } else {
      createUserDto.image = null;
    }
    createUserDto.location = JSON.parse(
      createUserDto.location?.toString() || "{}",
    );
    const user = await this.usersService.createUser(createUserDto);
    if (!user) {
      throw new InternalServerErrorException();
    }
    return user;
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a user (protected)" })
  @ApiParam({ name: "id", type: String })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileFieldsInterceptor([{ name: "image", maxCount: 1 }]))
  @ApiBody({ type: UpdateUserDto })
  async updateUser(
    @Param("id") userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
    },
  ): Promise<{ message: string; data: any }> {
    if (files?.image && files.image.length > 0) {
      updateUserDto.image = files.image[0];
    }
    if (updateUserDto.location) {
      console.log("Location before parsing:", updateUserDto.location);
      updateUserDto.location = JSON.parse(
        updateUserDto.location?.toString() || "{}",
      );
    }
    return this.usersService.updateUser(Number(userId), updateUserDto);
  }

  @Get("detail/:id")
  @ApiOperation({ summary: "Get user detail by ID (protected)" })
  @ApiParam({ name: "id", type: String })
  async getUser(@Param("id") userId: string): Promise<any> {
    return this.usersService.findUserById(Number(userId));
  }
  @Get("allUsers")
  @ApiOperation({ summary: "Get paginated list of all users with optional name search (protected)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String, description: "Search by user name (partial, case-insensitive)" })
  async getAllUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    return this.usersService.getAllUsers({ page, limit, search });
  }

  @Post("register-fcm-token")
  @ApiOperation({ summary: "Post acmToken against user" })
  @ApiResponse({ status: 200, description: "FCM token saved successfully" })
  @ApiBody({
    schema: { properties: { token: { type: "string" } } },
    required: true,
  })
  async registerFcmToken(
    @CurrentUser() user: JwtPayload,
    @Body("token") token: string,
  ) {
    return this.usersService.saveFcmToken(user.sub, token);
  }

  @Delete(":id/deactivate")
  @ApiOperation({ summary: "Disable/Delete user account (protected)" })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({ status: 200, description: "Account has been disabled successfully" })
  async disableAccount(
    @Param("id") userId: string,
  ): Promise<{ message: string; data: any }> {
    return this.usersService.disableAccount(Number(userId));
  }

  @Post(":id/reactivate")
  @ApiOperation({ summary: "Reactivate disabled user account (protected)" })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({ status: 200, description: "Account has been reactivated successfully" })
  async reactivateAccount(
    @Param("id") userId: string,
  ): Promise<{ message: string; data: any }> {
    return this.usersService.reactivateAccount(Number(userId));
  }
}
