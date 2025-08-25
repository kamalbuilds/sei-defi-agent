import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { PlaceOrderReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexCancelAndReplaceOrderInputSchema = z.object({
    orderId: z.string().startsWith("0x").describe("The ID of the order to replace"),
    isBuy: z.boolean().describe("Whether to buy (true) or sell (false)"),
    price: z.number().positive().describe("The price of the asset you intend to order"),
    productId: z.number().int().positive().describe("The product ID of asset"),
    quantity: z.number().positive().describe("The amount of the asset you intend to order"),
    expiration: z.number().optional().describe("The expiration time of the order in milliseconds (default: now + 30 days)"),
    nonce: z.number().optional().describe("A unique identifier for the order (default: current unix timestamp in nano seconds)"),
});

export class SeiCitrexCancelAndReplaceOrderTool extends StructuredTool<typeof CitrexCancelAndReplaceOrderInputSchema> {
    name = "citrex_cancel_and_replace_order";
    description = "Cancels and replaces an order on the Citrex Protocol. This is useful for updating an existing order without having to cancel it first and then place a new one. Returns the newly created order with details including order ID, account address, product information, price, quantity, order type, time in force, buy/sell direction, creation time, expiry, and status.";
    schema = CitrexCancelAndReplaceOrderInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexCancelAndReplaceOrderInputSchema>): Promise<PlaceOrderReturnType | undefined> {
        const { orderId, ...orderArgs } = input;
        return this.seiKit.citrexCancelAndReplaceOrder(orderId as `0x${string}`, orderArgs);
    }
} 