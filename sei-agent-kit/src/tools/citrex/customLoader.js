// Custom loader for ES modules in CommonJS context
export async function resolve(specifier, context, nextResolve) {
    // Special handling for citrex-sdk imports
    if (specifier === 'citrex-sdk') {
        return {
            url: new URL('../node_modules/citrex-sdk/lib/index.js', import.meta.url).href,
            shortCircuit: true,
        };
    }

    if (specifier === 'citrex-sdk/enums') {
        return {
            url: new URL('../node_modules/citrex-sdk/lib/enums.js', import.meta.url).href,
            shortCircuit: true,
        };
    }

    // Let Node.js handle all other specifiers
    return nextResolve(specifier);
} 