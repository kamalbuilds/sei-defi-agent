import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { OrderBookReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexGetOrderBookInputSchema = z.object({
    symbol: z.string().min(1),
});

export class SeiCitrexGetOrderBookTool extends StructuredTool<typeof CitrexGetOrderBookInputSchema> {
    name = "citrex_get_order_book";
    description = "Retrieves the order book for a product from the Citrex Protocol. The symbol must be a valid product symbol from the Citrex Protocol. Example: ETH -> 'ethperp', BTC -> 'btcperp', etc. Returns the order book with arrays of asks and bids, each containing price, quantity, and cumulative quantity information.";
    schema = CitrexGetOrderBookInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexGetOrderBookInputSchema>): Promise<OrderBookReturnType | undefined> {
        return this.seiKit.citrexGetOrderBook(input.symbol);
    }
}