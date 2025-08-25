import { Tool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { ServerTimeReturnType } from "../../../node_modules/citrex-sdk/lib/types.js";

export class SeiCitrexGetServerTimeTool extends Tool {
    name = "citrex_get_server_time";
    description = "Retrieves the current server time from the Citrex Protocol. Returns the server time as a Unix timestamp in milliseconds.";
    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(): Promise<ServerTimeReturnType | undefined> {
        return this.seiKit.citrexGetServerTime();
    }
} 