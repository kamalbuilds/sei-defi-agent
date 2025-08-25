import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { TimeInForce, OrderType } from "../../../node_modules/citrex-sdk/lib/enums.js";
import { PlaceOrderReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

// Input schema for placing an order on Citrex
const CitrexPlaceOrderInputSchema = z.object({
    isBuy: z.boolean().describe("Whether to buy (true) or sell (false)"),
    price: z.number().positive().describe("The price of the asset you intend to order."),
    productId: z.number().int().positive().describe("The product ID of asset"),
    quantity: z.number().positive().describe("The amount of the asset you intend to order ex. 1, 2"),
    orderType: z.nativeEnum(OrderType).optional().describe("The type of order (default: MARKET)"),
    timeInForce: z.nativeEnum(TimeInForce).optional().describe("The time in force for the order (default: FOK)"),
    expiration: z.number().optional().describe("The expiration time of the order in milliseconds (default: now + 30 days)"),
    nonce: z.number().optional().describe("A unique identifier for the order (default: current unix timestamp in nano seconds)"),
    priceIncrement: z.number().optional().describe("The price precision for the product (required for MARKET orders) find it in the product info under the 'increment' key. in wei ex. (10000000000000)"),
    slippage: z.number().optional().describe("The percentage by which to adjust the price when orderType is MARKET (default: 2.5%)"),
});

export class SeiCitrexPlaceOrderTool extends StructuredTool<typeof CitrexPlaceOrderInputSchema> {
    name = "citrex_place_order";
    description = "Places an order on the Citrex Protocol. You can place limit or market orders to buy or sell assets. Returns the created order with details including order ID, account address, product information, price, quantity, order type, time in force, buy/sell direction, creation time, expiry, and status.";
    schema = CitrexPlaceOrderInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexPlaceOrderInputSchema>): Promise<PlaceOrderReturnType | undefined> {
        return this.seiKit.citrexPlaceOrder(input);
    }
} 