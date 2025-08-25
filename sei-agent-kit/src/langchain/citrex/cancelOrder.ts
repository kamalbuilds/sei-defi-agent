import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { CancelOrderReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexCancelOrderInputSchema = z.object({
    orderId: z.string().startsWith("0x").describe("The unique order ID of the order to be cancelled"),
    productId: z.number().int().positive().describe("The product ID of the order to be cancelled"),
});

export class SeiCitrexCancelOrderTool extends StructuredTool<typeof CitrexCancelOrderInputSchema> {
    name = "citrex_cancel_order";
    description = "Cancels a specific order on the Citrex Protocol. You need both the order ID and the product ID to cancel an order. Returns a success flag indicating whether the cancellation was successful.";
    schema = CitrexCancelOrderInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexCancelOrderInputSchema>): Promise<CancelOrderReturnType | undefined> {
        const { orderId, productId } = input;
        return this.seiKit.citrexCancelOrder(orderId as `0x${string}`, productId);
    }
} 