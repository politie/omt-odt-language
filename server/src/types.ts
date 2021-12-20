import { DocumentLink, Range } from "vscode-languageserver/node";

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
 * Object containing the information for an OMT file, extending the OmtAvailableObjects with:
 * - documentLinks, paths used in imports that link to another file
 * - calledObjects, a list of used objects
 */
export interface OmtDocumentInformation extends OmtAvailableObjects {
    documentLinks: DocumentLink[];
    calledObjects: OmtLocalObject[];
}

/**
 * Object containing the information for available objects that can be reused:
 * - definedObjects, a list of defined objects in the file
 * - availableImports, a list of imported objects
 */
export interface OmtAvailableObjects {
    definedObjects: OmtLocalObject[];
    availableImports: OmtImport[];
}

/**
 * Used for declared objects in files, like Activities, Commands etc., and for used objects
 */
export interface OmtLocalObject {
    name: string;
    range: Range;
}

/**
 * Used to define the imports within an OMT file
 */
export interface OmtImport {
    name: string;
    url: string;
    fullUrl: string;
}

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