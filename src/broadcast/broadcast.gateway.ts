import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { BroadcastService } from "./broadcast.service";
import { forwardRef, Inject, Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*", // Adjust in production
  },
})
export class BroadcastGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  static serverInstance: Server;


  afterInit(server: Server) {
    BroadcastGateway.serverInstance = server;
  }

  private logger: Logger = new Logger("BroadcastGateway");

  constructor(
    @Inject(forwardRef(() => BroadcastService))
    private readonly broadcastService: BroadcastService,
  ) { }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("joinThread")
  async handleJoinThread(
    @MessageBody() data: { threadId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(String(data.threadId));
    this.logger.log(`Client ${client.id} joined thread ${data.threadId}`);
  }

  @SubscribeMessage("sendBroadcastMessage")
  async handleSendBroadcastMessage(
    @MessageBody()
    data: {
      broadcastId: number;
      threadId: number;
      senderId: number;
      receiverId: number;
      message: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const newMessage = await this.broadcastService.sendBroadcastMessage(
      data.broadcastId,
      data.senderId,
      data.receiverId,
      data.threadId,
      data.message,
    );

    this.server.to(String(data.threadId)).emit("receiveMessage", newMessage);
    // Emit the message to all clients in the thread room
    return newMessage
  }

  @SubscribeMessage("joinBroadcast")
  async handleJoinBroadcast(
    @MessageBody() data: { broadcastId: number; threadId: number },
    @ConnectedSocket() client: Socket,
  ) {
    // Join both broadcast and thread rooms for flexibility
    client.join(String(data.broadcastId));
    client.join(String(data.threadId));
    this.logger.log(
      `Client ${client.id} joined broadcast ${data.broadcastId} and thread ${data.threadId}`,
    );
  }

  @SubscribeMessage("leaveBroadcast")
  async handleLeaveBroadcast(
    @MessageBody() data: { broadcastId: number; threadId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(String(data.threadId));
    client.leave(String(data.broadcastId));
    this.logger.log(
      `Client ${client.id} left broadcast ${data.broadcastId} and thread ${data.threadId}`,
    );
  }
}
