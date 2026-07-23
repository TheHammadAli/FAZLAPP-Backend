// src/notifications/firebase.service.ts
import { Injectable, Logger } from "@nestjs/common";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      if (admin.apps.length || this.initialized) return;

      const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
      let serviceAccount: admin.ServiceAccount | undefined;

      if (serviceAccountEnv) {
        serviceAccount = this.parseServiceAccountEnv(serviceAccountEnv);
      }



      if (!serviceAccount) {
        throw new Error("Firebase service account could not be loaded.");
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      this.logger.log("Firebase initialized successfully");
    } catch (err) {
      this.logger.error("Firebase initialization failed", err);
    }
  }

  private parseServiceAccountEnv(value: string): admin.ServiceAccount | undefined {
    const normalized = this.stripOuterQuotes(value);

    try {
      return JSON.parse(normalized) as admin.ServiceAccount;
    } catch (error) {
      this.logger.warn(
        "FIREBASE_SERVICE_ACCOUNT json parsing failed, trying individual Firebase env vars.",
      );
      return undefined;
    }
  }

  private stripOuterQuotes(value: string): string {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    return value;
  }

  private buildServiceAccountFromEnv(): admin.ServiceAccount | undefined {
    const privateKey = this.normalizePrivateKey(
      process.env.FIREBASE_PRIVATE_KEY || process.env.PRIVATE_KEY,
    );
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;
    const clientId = process.env.FIREBASE_CLIENT_ID || process.env.CLIENT_ID;

    if (!projectId || !privateKey || !clientEmail) {
      return undefined;
    }
    //
    return {
      type: process.env.TYPE || "service_account",
      project_id: projectId,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: clientEmail,
      client_id: clientId,
      auth_uri: process.env.AUTH_URI,
      token_uri: process.env.TOKEN_URI,
      auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
      universe_domain: process.env.UNIVERSE_DOMAIN,
    } as admin.ServiceAccount;
  }

  private normalizePrivateKey(key?: string): string | undefined {
    if (!key) return undefined;

    const trimmed = key.trim();
    const withoutQuotes =
      trimmed.startsWith('"') && trimmed.endsWith('"')
        ? trimmed.slice(1, -1)
        : trimmed;

    return withoutQuotes.replace(/\\n/g, "\n");
  }

  /**
   * Sends a notification with an optional data payload
   * @param payload Optional Record for deep-linking or custom logic
   */
  async sendNotification(
    token: string,
    title: string,
    body: string,
    payload: Record<string, any> = {},
  ): Promise<string | null> {
    const isChatNotification = payload.type === "MESSAGE";
    const androidChannelId = isChatNotification
      ? "chat_message"
      : "marketing_service_channel";
    const soundName = isChatNotification ? "message" : "service_request";
    const iosSoundName = isChatNotification ? "message.wav" : "service_request.wav";

    try {
      if (!admin.apps.length) {
        this.logger.warn("Firebase not initialized. Skipping notification.");
        return null;
      }

      // 1️⃣ Sanitize custom application payload: FCM 'data' values MUST be strings.
      const sanitizedData: Record<string, string> = {};
      Object.entries(payload).forEach(([key, value]) => {
        sanitizedData[key] =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      });

      // 2️⃣ Explicitly bundle configurations for the frontend to read inside 'data'
      const androidConfigForFrontend = {
        notification: {
          channelId: androidChannelId,
          sound: soundName,
        },
      };

      const apnsConfigForFrontend = {
        payload: {
          aps: {
            sound: iosSoundName,
            mutableContent: true,
          },
        },
      };

      // Add them directly to the data object so the frontend receives them
      sanitizedData.android = JSON.stringify(androidConfigForFrontend);
      sanitizedData.apns = JSON.stringify(apnsConfigForFrontend);

      // Keep legacy flat keys if your frontend is already expecting them
      sanitizedData.notificationChannel = androidChannelId;
      sanitizedData.notificationSoundAndroid = soundName;
      sanitizedData.notificationSoundIos = iosSoundName;

      // 3️⃣ Send message (FCM reads top-level android/apns; Frontend reads data)
      // Send message (FCM reads top-level android/apns; Frontend reads data)
      return await admin.messaging().send({
        token,
        notification: { title, body },
        data: sanitizedData,
        android: {
          priority: "high",
          notification: androidConfigForFrontend.notification,
        },
        apns: {
          headers: {
            "apns-priority": "10", // 10 = Deliver immediately
          },
          payload: {
            aps: {
              // Explicit alert block ensures iOS matches the Firebase Console layout
              alert: {
                title: title,
                body: body,
              },
              sound: iosSoundName,
              badge: 1,
              mutableContent: true,
              // ❌ REMOVED contentAvailable: true to prevent iOS from treating it as a silent background event
            },
          },
        },
      });

      //  {
      //   "messageId": "1783857377129001",
      //   "from": "1042475957024",
      //   "data": {},
      //   "sentTime": "1783857376",
      //   "mutableContent": true,
      //   "notification": {
      //     "body": "test",
      //     "title": "test"
      //   }
      // }





    } catch (err) {
      this.logger.error("FCM error (notification skipped)", err);
      return null;
    }
  }
}
