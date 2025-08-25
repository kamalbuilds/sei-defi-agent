import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { TradeHistoryReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexGetTradeHistoryInputSchema = z.object({
    productSymbol: z.string().min(1).describe("The product symbol to get data for (e.g., 'btcperp', 'ethperp')"),
    quantity: z.number().int().min(1).max(500).optional().describe("The quantity of trades to fetch (maximum 500, default 10)"),
});

export class SeiCitrexGetTradeHistoryTool extends StructuredTool<typeof CitrexGetTradeHistoryInputSchema> {
    name = "citrex_get_trade_history";
    description = "Retrieves trade history for a product on the Citrex Protocol. This shows recent trades that have occurred for a specific trading pair. Returns an array of trades with details including timestamp, maker/taker information, price, quantity, fees, trade direction, and unique identifiers.";
    schema = CitrexGetTradeHistoryInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexGetTradeHistoryInputSchema>): Promise<TradeHistoryReturnType | undefined> {
        const { productSymbol, quantity } = input;
        return this.seiKit.citrexGetTradeHistory(productSymbol as `${string}perp`, quantity);
    }
} 