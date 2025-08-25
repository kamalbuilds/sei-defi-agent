import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { CancelOrderReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

// Define a schema for a single order cancellation
const OrderCancelSchema = z.object({
    orderId: z.string().startsWith("0x").describe("The unique order ID of the order to be cancelled"),
    productId: z.number().int().positive().describe("The product ID of the order to be cancelled"),
});

const CitrexCancelOrdersInputSchema = z.object({
    orders: z.array(OrderCancelSchema).min(1).describe("Array of orders to cancel, each with orderId and productId"),
});

export class SeiCitrexCancelOrdersTool extends StructuredTool<typeof CitrexCancelOrdersInputSchema> {
    name = "citrex_cancel_orders";
    description = "Cancels multiple orders on the Citrex Protocol in a single operation. This is more efficient than cancelling orders one by one. Returns an array of success flags indicating whether each cancellation was successful.";
    schema = CitrexCancelOrdersInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexCancelOrdersInputSchema>): Promise<CancelOrderReturnType[] | undefined> {
        const { orders } = input;
        // Convert to the format expected by the SDK
        const formattedOrdersArgs = orders.map(({ orderId, productId }) =>
            [orderId as `0x${string}`, productId] as [`0x${string}`, number]
        );
        return this.seiKit.citrexCancelOrders(formattedOrdersArgs);
    }
} 