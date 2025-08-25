import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { CalculateMarginRequirementReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";
import { z } from "zod";

const CitrexCalculateMarginRequirementInputSchema = z.object({
    isBuy: z.boolean().describe("Whether to buy (true) or sell (false)"),
    price: z.number().positive().describe("The price of the asset you intend to order"),
    productId: z.number().int().positive().describe("The product ID of asset"),
    quantity: z.number().positive().describe("The amount of the asset you intend to order"),
});

export class SeiCitrexCalculateMarginRequirementTool extends StructuredTool<typeof CitrexCalculateMarginRequirementInputSchema> {
    name = "citrex_calculate_margin_requirement";
    description = "Calculate the required margin for a new order on the Citrex Protocol. This helps determine how much collateral is needed for a trade. Returns the required margin amount as a bigint value.";
    schema = CitrexCalculateMarginRequirementInputSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(input: z.infer<typeof CitrexCalculateMarginRequirementInputSchema>): Promise<CalculateMarginRequirementReturnType | undefined> {
        const { isBuy, price, productId, quantity } = input;
        return this.seiKit.citrexCalculateMarginRequirement(isBuy, price, productId, quantity);
    }
} 