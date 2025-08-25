import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { KlinesReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexGetKlinesInputSchema = z.object({
    productSymbol: z.string().min(1).describe("The product symbol to get data for (e.g., 'btcperp', 'ethperp')"),
    interval: z.string().optional().describe("The time interval for each K-line (e.g., '1m', '5m', '1h', '1d')"),
    limit: z.number().int().min(1).max(1000).optional().describe("The amount of K-lines to fetch (between 1 and 1000)"),
    startTime: z.number().optional().describe("The start time range to query in unix milliseconds"),
    endTime: z.number().optional().describe("The end time range to query in unix milliseconds"),
});

export class SeiCitrexGetKlinesTool extends StructuredTool<typeof CitrexGetKlinesInputSchema> {
    name = "citrex_get_klines";
    description = "Get K-line (candlestick) chart data for a product on the Citrex Protocol. This provides historical price data for technical analysis. Returns an array of K-lines containing open, close, high, low prices, volume, timestamp, symbol, interval information, and whether the candle is closed.";
    schema = CitrexGetKlinesInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexGetKlinesInputSchema>): Promise<KlinesReturnType | undefined> {
        const { productSymbol, ...optionalArgs } = input;
        return this.seiKit.citrexGetKlines(productSymbol as `${string}perp`,
            Object.keys(optionalArgs).length > 0 ? optionalArgs : undefined);
    }
} 