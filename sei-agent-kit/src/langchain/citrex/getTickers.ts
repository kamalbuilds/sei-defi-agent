import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { TickerReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexGetTickersInputSchema = z.object({
    symbol: z.string().min(1).optional(),
});

export class SeiCitrexGetTickersTool extends StructuredTool<typeof CitrexGetTickersInputSchema> {
    name = "citrex_get_tickers";
    description = "Retrieves the tickers for the Citrex Protocol. The symbol must be a valid product symbol from the Citrex Protocol. Example: ETH -> 'ethperp', BTC -> 'btcperp', etc. Returns ticker data including funding rates (hourly/yearly), price data (high/low/mark), next funding time, open interest, oracle price, price change info, product details, and trading volume.";
    schema = CitrexGetTickersInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexGetTickersInputSchema>): Promise<TickerReturnType | undefined> {
        return this.seiKit.citrexGetTickers(input.symbol as `${string}perp`);
    }
}