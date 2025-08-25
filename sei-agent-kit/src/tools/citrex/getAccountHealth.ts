import CitrexSDK from '../../../node_modules/citrex-sdk/lib/index.js'
import { Config, AccountHealthReturnType } from '../../../node_modules/citrex-sdk/lib/types.js'
import * as dotenv from 'dotenv'

dotenv.config()

export async function citrexGetAccountHealth(): Promise<AccountHealthReturnType | undefined> {
    const MY_PRIVATE_KEY = process.env.SEI_PRIVATE_KEY

    try {
        const CONFIG = {
            debug: false,
            environment: 'mainnet',
            rpc: 'https://evm-rpc.sei-apis.com',
            subAccountId: 0,
        }
        const Client = new CitrexSDK(MY_PRIVATE_KEY as `0x${string}`, CONFIG as Config)
        const returnAccountHealth = await Client.getAccountHealth()
        return returnAccountHealth
    } catch (error) {
        console.error(error)
        return
    }
}