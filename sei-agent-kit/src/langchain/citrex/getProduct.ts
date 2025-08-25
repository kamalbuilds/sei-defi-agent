import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { ProductReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexGetProductInputSchema = z.object({
    identifier: z.union([
        z.number().int().positive().describe("The product ID to retrieve"),
        z.string().min(1).describe("The product symbol to retrieve (e.g., 'btcperp', 'ethperp')")
    ]).describe("The product ID or symbol to look up"),
});

export class SeiCitrexGetProductTool extends StructuredTool<typeof CitrexGetProductInputSchema> {
    name = "citrex_get_product";
    description = "Retrieves information about a specific product on the Citrex Protocol using either its ID or symbol. Returns detailed product information including ID, symbol, base/quote assets, fees, price increment, min/max quantities, weights, mark price, and active status.";
    schema = CitrexGetProductInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexGetProductInputSchema>): Promise<ProductReturnType | undefined> {
        const { identifier } = input;
        return this.seiKit.citrexGetProduct(identifier);
    }
} 