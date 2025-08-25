import CitrexSDK from '../../../node_modules/citrex-sdk/lib/index.js'
import { Config, PositionsReturnType } from '../../../node_modules/citrex-sdk/lib/types.js'
import { ProductSymbol } from '../../../node_modules/citrex-sdk/lib/types.js'
import * as dotenv from 'dotenv'

dotenv.config()

export async function citrexListPositions(
    productSymbol?: ProductSymbol
): Promise<PositionsReturnType | undefined> {
    const MY_PRIVATE_KEY = process.env.SEI_PRIVATE_KEY

    try {
        const CONFIG = {
            debug: false,
            environment: 'mainnet',
            rpc: 'https://evm-rpc.sei-apis.com',
            subAccountId: 0,
        }
        const Client = new CitrexSDK(MY_PRIVATE_KEY as `0x${string}`, CONFIG as Config)
        const result = await Client.listPositions(productSymbol)
        return result
    } catch (error) {
        console.error(error)
        return
    }
} 