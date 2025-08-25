import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { CancelOrdersReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexCancelOpenOrdersForProductInputSchema = z.object({
    productId: z.number().int().positive().describe("The product ID of the orders to be cancelled"),
});

export class SeiCitrexCancelOpenOrdersForProductTool extends StructuredTool<typeof CitrexCancelOpenOrdersForProductInputSchema> {
    name = "citrex_cancel_open_orders_for_product";
    description = "Cancels all open orders for a specific product on the Citrex Protocol. This is useful for quickly closing all positions for a particular trading pair. Returns a success flag indicating whether the operation was successful.";
    schema = CitrexCancelOpenOrdersForProductInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexCancelOpenOrdersForProductInputSchema>): Promise<CancelOrdersReturnType | undefined> {
        const { productId } = input;
        return this.seiKit.citrexCancelOpenOrdersForProduct(productId);
    }
} 