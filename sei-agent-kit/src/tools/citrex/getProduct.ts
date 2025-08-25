import CitrexSDK from '../../../node_modules/citrex-sdk/lib/index.js'
import { Config, ProductReturnType } from '../../../node_modules/citrex-sdk/lib/types.js'
import * as dotenv from 'dotenv'

dotenv.config()

export async function citrexGetProduct(
    identifier: number | string
): Promise<ProductReturnType | undefined> {
    const MY_PRIVATE_KEY = process.env.SEI_PRIVATE_KEY

    try {
        const CONFIG = {
            debug: false,
            environment: 'mainnet',
            rpc: 'https://evm-rpc.sei-apis.com',
            subAccountId: 1,
        }
        const Client = new CitrexSDK(MY_PRIVATE_KEY as `0x${string}`, CONFIG as Config)
        const result = await Client.getProduct(identifier)
        return result
    } catch (error) {
        console.error(error)
        return
    }
} 