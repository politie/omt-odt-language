
export type OMTModule = {
    name: string,
    uri: string,
}

export type CheckFileResult = {
    path: string,
} & CheckTextResult

export type CheckTextResult = {
    module?: {
        name: string,
    },
}

export function isDeclaredImportLinkData(data: unknown): data is DeclaredImportLinkData {
    const linkData = (<DeclaredImportLinkData>data);
    return linkData.declaredImport !== undefined && linkData.declaredImport.module !== undefined;
}

export type DeclaredImportLinkData = {
    declaredImport: {
        module: string
    }
}
