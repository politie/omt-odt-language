/**
 * All the useful information about an OMT module
 */
export type OMTModule = {
    name: string,
    uri: string,
};

/**
 * Description of what OMT properties could be found in a file at a specified path.
 */
export type CheckFileResult = {
    path: string,
} & CheckTextResult;

/**
 * Description of what OMT properties can be found in a text
 */
export type CheckTextResult = {
    module?: {
        name: string,
    },
};

/**
 * Type guard for `DeclaredImportLinkData`
 * @param data object that could be `DeclaredImportLinkData`
 */
export function isDeclaredImportLinkData(data: unknown): data is DeclaredImportLinkData {
    const linkData = data as DeclaredImportLinkData;
    return linkData.declaredImport?.module !== undefined;
}

/**
 * Data nescesary to resolve a declared import link
 */
export type DeclaredImportLinkData = {
    declaredImport: {
        module: string
    }
}
