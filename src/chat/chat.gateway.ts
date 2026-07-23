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
import { ChatService } from "./chat.service";
import { forwardRef, Inject, Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*", // Adjust in production
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;
  static serverInstance: Server;

  afterInit(server: Server) {
    ChatGateway.serverInstance = server;
  }



  private logger: Logger = new Logger("ChatGateway");

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) { }

  handleConnection(client: Socket) {
    console.log("Client connected", client.id);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("joinConversation")
  async handleJoinRoom(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(String(data.conversationId));
    this.logger.log(
      `Client ${client.id} joined conversation ${data.conversationId}`,
    );
  }

  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @MessageBody()
    data: {
      conversationId: number;
      senderId: number;
      receiverId: number;
      text: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const message = await this.chatService.sendMessage(
      data.conversationId,
      data.senderId,
      data.receiverId,
      data.text,
    );

     this.server.to(String(data.conversationId)).emit("receiveMessage", message);


    return message;
  }

  @SubscribeMessage("startConversation")
  async handleStartConversation(
    @MessageBody() data: { buyerId: number; sellerId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const convo = await this.chatService.getOrCreateConversation(
      data.buyerId,
      data.sellerId,
    );
    client.join(convo?.id.toString());
    this.logger.log(
      `Client ${client.id} joined or created conversation ${convo?.id}`,
    );
    client.emit("conversationStarted", convo);
  }

  @SubscribeMessage("markAsRead")
  async handleMarkAsRead(
    @MessageBody() data: { conversationId: number; userId: number },
  ) {
    await this.chatService.markAsRead(data.conversationId, data.userId);
    this.server.to(String(data.conversationId)).emit("messagesMarkedAsRead", {
      userId: data.userId,
    });
  }
}
