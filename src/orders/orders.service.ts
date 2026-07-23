import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { CreateOrderDto } from "./dto/create-order-dto";
import { UpdateOrderDto } from "./dto/update-order-dto";
import { UsersService } from "src/users/users.service";
import { ProductsService } from "src/products/products.service";
import { ShopService } from "src/shop/shop.service";
import { NotificationsService } from "src/notifications/notifications.service";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "src/core/prisma/prisma.service";

const VALID_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => ShopService))
    private readonly shopService: ShopService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) { }


  private readonly constants = {
    orders: {
      placed: "placed",
      confirmed: "confirmed",
      shipped: "shipped",
      delivered: "delivered",
      cancelled: "cancelled",
      received: "received",
    },
  };
  /** Dynamic getter for the current request language */
  private get lang(): string {
    return this.cls.get("lang") || "en";
  }

  /**
   * Mirrors Mongoose's refPath-based populate on the polymorphic
   * owner/ownerModel pair — Order.owner has no Prisma relation (per the
   * Critical Gap decision), so it's resolved manually here instead.
   */
  private async resolveOwner(owner: number, ownerModel: "Shop" | "User") {
    return ownerModel === "Shop"
      ? this.shopService.getShopById(owner)
      : this.usersService.findUserById(owner);
  }

  async createMultipleOrders(dto: CreateOrderDto[]) {
    const results = await Promise.all(
      dto.map(async (orderDto) => {
        try {
          return await this.createOrder(orderDto);
        } catch (error) {
          // Log the error and continue with the next order
          console.error(`Failed to create order for product ${orderDto.product}:`, error);
          return null;
        }
      }),
    );

    return {
      message: this.i18n.translate("auth.orders.created_success", { lang: this.lang }),
      data: results,
    };
  }

  // CREATE: Logic updated to include mandatory payloads and post-save notifications
  async createOrder(dto: CreateOrderDto) {
    // 1. Validation Logic
    const buyer = await this.usersService.findUserById(dto.buyer);
    if (!buyer)
      throw new NotFoundException(
        this.i18n.translate("auth.orders.buyer_not_found", { lang: this.lang }),
      );

    const product = await this.productsService.getById(dto.product);
    if (!product)
      throw new NotFoundException(
        this.i18n.translate("auth.orders.product_not_found", {
          lang: this.lang,
        }),
      );

    const owner: any = await this.resolveOwner(dto.owner, dto.ownerModel);
    const ownerExists = !!owner;

    if (!ownerExists)
      throw new NotFoundException(
        this.i18n.translate("auth.orders.order_owner_not_found", {
          lang: this.lang,
        }),
      );

    let isValidOwner = false;
    if (dto.ownerModel === "Shop") {
      isValidOwner = dto.owner === product.shopId?.id;
    } else if (dto.ownerModel === "User") {
      isValidOwner = dto.owner === product.ownerId?.id;
    }

    if (!isValidOwner) {
      throw new BadRequestException(
        this.i18n.translate("auth.orders.order_mismatch", { lang: this.lang }),
      );
    }

    // 2. Prepare and Save
    const savedOrder = await this.prisma.order.create({
      data: {
        buyerId: dto.buyer,
        owner: dto.owner,
        ownerModel: dto.ownerModel,
        productId: dto.product,
        deliveryOption:
          dto.deliveryOption === "self-pickup" ? "self_pickup" : "delivery",
        status: dto.status,
        paymentType: dto.paymentType,
        amount: dto.amount,
        variant: dto.variant,
        quantity: dto.quantity,
      },
    });

    // 3. Post-Save Notifications with Generic Payload
    const notificationPayload = {
      orderId: savedOrder.id,
      productId: dto.product,
      ownerModel: dto.ownerModel,
      actionType: this.constants.orders.placed,
    };

    // Notify buyer (using translation placeholders)
    this.notificationsService.createAndNotify(
      dto.buyer,
      "order_created_buyer",
      "ORDER",
      notificationPayload,
      { productTitle: product.title },
    );

    // Notify owner/seller
    this.notificationsService.createAndNotify(
      dto.ownerModel === "Shop" ? owner.ownerId?.id : owner.id || dto.owner,
      "order_created_seller",
      "ORDER",
      { ...notificationPayload, actionType: this.constants.orders.received },
      { productTitle: product.title },
    );

    return {
      message: this.i18n.translate("auth.orders.created_success", { lang: this.lang }),
      data: savedOrder,
    };
  }

  // READ: Get by ID
  async getOrderById(orderId: number): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true, product: true },
    });

    if (!order)
      throw new NotFoundException(
        this.i18n.translate("auth.orders.order_not_found", { lang: this.lang }),
      );

    const { owner: ownerScalar, ...rest } = order as any;
    const owner = await this.resolveOwner(order.owner, order.ownerModel);

    return { ...rest, owner };
  }

  // READ: List by Owner
  async getOrdersByOwner(
    ownerId: number,
    ownerModel: "Shop" | "User",
    page = 1,
    limit = 10,
    status?: string,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    if (page < 1 || limit < 1)
      throw new BadRequestException(
        this.i18n.translate("auth.orders.invalid_page_limit", {
          lang: this.lang,
        }),
      );

    const skip = (page - 1) * limit;

    const where: any = { owner: ownerId, ownerModel };

    if (status) {
      if (VALID_ORDER_STATUSES.includes(status)) {
        where.status = status;
      } else {
        where.id = -1;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // READ: List by Buyer
  async getOrdersByBuyer(
    buyerId: number,
    page = 1,
    limit = 10,
    status?: string,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const where: any = { buyerId };

    if (status) {
      if (VALID_ORDER_STATUSES.includes(status)) {
        where.status = status;
      } else {
        where.id = -1;
      }
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    const dataWithOwners = await Promise.all(
      data.map(async (order: any) => {
        const { owner: ownerScalar, ...rest } = order;
        const owner = await this.resolveOwner(order.owner, order.ownerModel);
        return { ...rest, owner };
      }),
    );

    return {
      data: dataWithOwners,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // UPDATE: Logic updated to notify on status changes
  async updateOrder(orderId: number, dto: UpdateOrderDto) {
    let updated: any;
    try {
      updated = await this.prisma.order.update({
        where: { id: orderId },
        data: dto,
        include: { product: true },
      });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.orders.order_not_found", { lang: this.lang }),
      );
    }

    // If the order status was updated, notify the buyer with the new status
    if (dto.status) {
      const productTitle = (updated.product as any)?.title || "Product";

      this.notificationsService.createAndNotify(
        updated.buyerId,
        "order_status_updated",
        "ORDER",
        {
          orderId: updated.id, // This is our mandatory generic payload
          status: dto.status,
          productId: updated.productId, // Optional additional payload
          actionType: updated.status,
        },
        {
          productTitle: productTitle,
          status: dto.status,
        },
      );
    }

    return {
      message: this.i18n.translate("auth.orders.updated_success", {
        lang: this.lang,
      }),
      data: updated,
    };
  }

  // DELETE
  async deleteOrder(orderId: number): Promise<void> {
    try {
      await this.prisma.order.delete({ where: { id: orderId } });
    } catch {
      throw new NotFoundException(
        this.i18n.translate("auth.orders.order_not_found", { lang: this.lang }),
      );
    }
  }
}
