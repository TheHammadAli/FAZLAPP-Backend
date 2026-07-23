import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";

@Injectable()
export class FileUploadService {
  private s3: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>("AWS_REGION");
    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>(
      "AWS_SECRET_ACCESS_KEY",
    );
    const bucket = this.configService.get<string>("AWS_S3_BUCKET_NAME");

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error("Missing AWS S3 configuration");
    }

    console.log(
      `Initializing S3 client with bucket: ${bucket}`,
      accessKeyId,
      secretAccessKey,
      region,
    );

    this.bucketName = bucket;
    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadProductFiles(
    files: Express.Multer.File[],
    type: string,
    entityId: number,
    productId: number,
    fileType: "images" | "video" = "images",
  ): Promise<{ key: string; url: string }[]> {
    const uploadedFiles: { key: string; url: string }[] = [];

    console.log("Uploading files:", files);
    for (const file of files) {
      const fileExt = extname(file.originalname);
      const uniqueName = `${uuidv4()}${fileExt}`;
      let key = `${type}/${entityId}/products/${productId}/${fileType}/${uniqueName}`;
      if (fileType === "video") {
        key = `${type}/${entityId}/products/${productId}/video`;
      }
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        console.log(`Uploading file to S3 with key: ${key}`);
        await this.s3.send(command);

        const url = `https://${this.bucketName}.s3.${this.configService.get(
          "AWS_REGION",
        )}.amazonaws.com/${key}`;

        console.log(`File uploaded successfully: ${url}`);
        uploadedFiles.push({ key, url });
      } catch (err) {
        console.error("S3 upload error:", err);
        throw new InternalServerErrorException(
          "One or more file uploads failed",
        );
      }
    }

    return uploadedFiles;
  }

  async uploadUserImage(userId: number, file: Express.Multer.File) {
    const fileExt = extname(file.originalname);

    const key = `users/${userId}/images/profile-pic`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      console.log(`Uploading file to S3 with key: ${key}`);
      await this.s3.send(command);

      const url = `https://${this.bucketName}.s3.${this.configService.get(
        "AWS_REGION",
      )}.amazonaws.com/${key}`;

      console.log(`File uploaded successfully: ${url}`);
      return url;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("One or more file uploads failed");
    }
  }
  async uploadShopImage(shopId: number, file: Express.Multer.File) {
    const key = `shop/${shopId}/images/logo`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      console.log(`Uploading file to S3 with key: ${key}`);
      await this.s3.send(command);

      const url = `https://${this.bucketName}.s3.${this.configService.get(
        "AWS_REGION",
      )}.amazonaws.com/${key}`;

      console.log(`File uploaded successfully: ${url}`);
      return url;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("One or more file uploads failed");
    }
  }

  async uploadCategoryIcon(file: any) {
    const fileExt = extname(file.originalname);
    const uniqueName = `${uuidv4()}${fileExt}`;
    const key = `categories/icons/${uniqueName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3.send(command);

      const url = `https://${this.bucketName}.s3.${this.configService.get(
        "AWS_REGION",
      )}.amazonaws.com/${key}`;

      console.log(`File uploaded successfully: ${url}`);
      return url;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("Category icon upload failed");
    }
  }

  async uploadShopBanner(shopId: number, file: Express.Multer.File) {
    const key = `shop/${shopId}/images/banner`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      console.log(`Uploading file to S3 with key: ${key}`);
      await this.s3.send(command);

      const url = `https://${this.bucketName}.s3.${this.configService.get(
        "AWS_REGION",
      )}.amazonaws.com/${key}`;

      console.log(`File uploaded successfully: ${url}`);
      return url;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("One or more file uploads failed");
    }
  }
  async uploadServiceFile(
    userId: number,
    serviceId: number,
    files: Express.Multer.File[],
    fileType: "images" | "video" = "images",
  ) {
    const uploadedFiles: string[] = [];

    console.log("Uploading files:", files);
    for (const file of files) {
      const fileExt = extname(file.originalname);
      const uniqueName = `${uuidv4()}${fileExt}`;
      let key = `service/${userId}/${serviceId}/${fileType}/${uniqueName}`;

      if (fileType === "video") {
        key = `service/${userId}/${serviceId}/video`;
      }
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        console.log(`Uploading file to S3 with key: ${key}`);
        await this.s3.send(command);

        const url = `https://${this.bucketName}.s3.${this.configService.get(
          "AWS_REGION",
        )}.amazonaws.com/${key}`;

        console.log(`File uploaded successfully: ${url}`);
        uploadedFiles.push(url);
      } catch (err) {
        console.error("S3 upload error:", err);
        throw new InternalServerErrorException(
          "One or more file uploads failed",
        );
      }
    }

    return uploadedFiles;
  }

  async deleteEntityProducts(
    type: string,
    entityId: number,
    productId?: number,
  ): Promise<void> {
    try {
      const prefix = `${type}/${entityId}/products/${productId}`;
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: prefix,
      });

      console.log(`Deleting files from S3 with prefix: ${prefix}`);
      await this.s3.send(command);
      console.log(`Files deleted successfully from S3 with prefix: ${prefix}`);
    } catch (err) { }
  }

  async deleteFiles(media: string[]): Promise<void> {
    try {
      for (const path of media) {
        const key = path.split(
          `https://${this.bucketName}.s3.us-east-1.amazonaws.com/`,
        )[1];

        if (!key) throw new Error("Invalid S3 URL");

        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });

        console.log(`Deleting file from S3 with key: ${key}`);
        await this.s3.send(command);
        console.log(`File deleted successfully: ${key}`);
      }
    } catch (err) {
      console.error("S3 delete error:", err);
      throw new InternalServerErrorException("File deletion failed");
    }
  }

  async uploadChatMessage(
    conversationId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    const fileExt = extname(file.originalname);
    const uniqueName = `${uuidv4()}${fileExt}`;
    const key = `chats/${conversationId}/${uniqueName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3.send(command);

      return `https://${this.bucketName}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("Chat image upload failed");
    }
  }

  // file-upload.service.ts

  async uploadBroadcastImage(
    buyerId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    const fileExt = extname(file.originalname);
    const uniqueName = `${uuidv4()}${fileExt}`;
    // Structure: broadcasts/buyerId/uuid.ext
    const key = `broadcasts/${buyerId}/${uniqueName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3.send(command);

      return `https://${this.bucketName}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("Broadcast image upload failed");
    }
  }
  // file-upload.service.ts

  async uploadBroadcastThreadImage(
    threadId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    const fileExt = extname(file.originalname);
    const uniqueName = `${uuidv4()}${fileExt}`;
    const key = `broadcasts/threads/${threadId}/${uniqueName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3.send(command);

      return `https://${this.bucketName}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw new InternalServerErrorException("Thread image upload failed");
    }
  }
}
