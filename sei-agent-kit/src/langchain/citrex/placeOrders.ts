import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { PlaceOrderReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { OrderType, TimeInForce } from "../../../node_modules/citrex-sdk/lib/enums.js";
import { z } from "zod";

// Define the schema for a single order
const OrderSchema = z.object({
    isBuy: z.boolean().describe("Whether to buy (true) or sell (false)"),
    price: z.number().positive().describe("The price of the asset you intend to order"),
    productId: z.number().int().positive().describe("The product ID of asset"),
    quantity: z.number().positive().describe("The amount of the asset you intend to order"),
    orderType: z.nativeEnum(OrderType).optional().describe("The type of order (default: MARKET)"),
    timeInForce: z.nativeEnum(TimeInForce).optional().describe("The time in force for the order (default: FOK)"),
    expiration: z.number().optional().describe("The expiration time of the order in milliseconds (default: now + 30 days)"),
    nonce: z.number().optional().describe("A unique identifier for the order (default: current unix timestamp in nano seconds)"),
    priceIncrement: z.number().optional().describe("The price precision for the product (required for MARKET orders)"),
    slippage: z.number().optional().describe("The percentage by which to adjust the price when orderType is MARKET (default: 2.5%)"),
});

// Input schema for placing multiple orders
const CitrexPlaceOrdersInputSchema = z.object({
    orders: z.array(OrderSchema).min(1).describe("Array of orders to place"),
});

export class SeiCitrexPlaceOrdersTool extends StructuredTool<typeof CitrexPlaceOrdersInputSchema> {
    name = "citrex_place_orders";
    description = "Places multiple orders on the Citrex Protocol in a single operation. This is more efficient than placing orders one by one. Returns an array of created orders, each with details including order ID, account address, product information, price, quantity, order type, time in force, buy/sell direction, creation time, expiry, and status.";
    schema = CitrexPlaceOrdersInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexPlaceOrdersInputSchema>): Promise<PlaceOrderReturnType[] | undefined> {
        const { orders } = input;
        return this.seiKit.citrexPlaceOrders(orders);
    }
} 