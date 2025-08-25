import CitrexSDK from '../../../node_modules/citrex-sdk/lib/index.js'
import { Config, HexString, ProductsReturnType } from '../../../node_modules/citrex-sdk/lib/types.js'
import * as dotenv from 'dotenv'
import { formatWei } from '../../utils/formatSei.js'

dotenv.config()
export interface product {
    active: boolean;
    baseAsset: string;
    baseAssetAddress: HexString;
    increment: bigint;
    id: number;
    initialLongWeight: bigint;
    initialShortWeight: bigint;
    isMakerRebate: boolean;
    makerFee: bigint;
    maintenanceLongWeight: bigint;
    maintenanceShortWeight: bigint;
    markPrice: number;
    maxQuantity: bigint;
    minQuantity: bigint;
    quoteAsset: string;
    quoteAssetAddress: HexString;
    symbol: string;
    takerFee: bigint;
    type: string;
}

interface productParsed {
    products: product[]
}

export async function citrexGetProducts(): Promise<productParsed | undefined> {
    const MY_PRIVATE_KEY = process.env.SEI_PRIVATE_KEY

    try {
        const CONFIG = {
            debug: false,
            environment: 'mainnet',
            rpc: 'https://evm-rpc.sei-apis.com',
            subAccountId: 0,
        }
        const Client = new CitrexSDK(MY_PRIVATE_KEY as `0x${string}`, CONFIG as Config)
        const returnProducts = await Client.getProducts()
        const returnProductParsed: productParsed = {
            products: returnProducts.products.map((product) => ({
                ...product,
                markPrice: Number(formatWei(Number(product.markPrice), 18))
            }))
        }
        return returnProductParsed
    } catch (error) {
        console.error(error)
        return
    }
}
