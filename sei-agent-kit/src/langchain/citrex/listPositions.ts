import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { PositionsReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexListPositionsInputSchema = z.object({
    productSymbol: z.string().min(1).optional().describe("Optional product symbol to filter by (e.g., 'btcperp', 'ethperp')"),
});

export class SeiCitrexListPositionsTool extends StructuredTool<typeof CitrexListPositionsInputSchema> {
    name = "citrex_list_positions";
    description = "Lists all positions for the account and sub-account on the Citrex Protocol. Can be filtered by product symbol. Returns an array of positions with details including account address, position quantity, entry price, liquidation price, mark price, accrued funding, margin, PnL, and product information.";
    schema = CitrexListPositionsInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexListPositionsInputSchema>): Promise<PositionsReturnType | undefined> {
        const { productSymbol } = input;
        return this.seiKit.citrexListPositions(productSymbol as `${string}perp` | undefined);
    }
} 