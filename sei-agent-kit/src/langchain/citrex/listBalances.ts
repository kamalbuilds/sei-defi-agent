import { Tool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { BalancesReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";

export class SeiCitrexListBalancesTool extends Tool {
    name = "citrex_list_balances";
    description = "Lists all margin balances for the account and sub-account on the Citrex Protocol, quantity returned is in wei. Returns an array of balances with details including wallet address, asset type, available quantity, and any pending withdrawals.";
    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(): Promise<BalancesReturnType | undefined> {
        return this.seiKit.citrexListBalances();
    }
} 