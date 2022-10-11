import { dirname, resolve } from 'path';
import { DocumentLink, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { WorkspaceLookup } from './workspaceLookup';
import { DeclaredImportLinkData, isDeclaredImportLinkData, OmtAvailableObjects, OmtDocumentInformation, OmtImport, OmtLocalObject } from './types';
import { YAMLError } from 'yaml/util';
import { getAvailableObjectsFromDocument } from './omtAvailableObjectsProvider';
import { dirpath, getDiMatch } from './importMatch';

const newLine = /\r?\n/;

/**
 * Provides DocumentLinks for the imports of an OMT file.
 */
export default class OmtDocumentInformationProvider {

    private tsConfigFiles = glob.sync('**/tsconfig**.json', {realpath: true});

    constructor(private workspaceLookup: WorkspaceLookup) { }

    /**
     * Scan the document for imports/declarations/used objects and returns an OmtDocumentInformation object.
     * @param document the document containing OMT
     * @returns an OmtDocumentInformation object
     */
    provideDocumentInformation(document: TextDocument): OmtDocumentInformation {
        // regular path links, with or without shorthands
        const shorthands = this.contextPaths(document);
        return this.getOmtDocumentInformation(document, shorthands);
    }

    /**
     * Scan the document and return the imports and declard objects
     * @param document the document containing OMT
     * @returns an OmtAvailableObjects object, containing a list of imported objects and declared objects
     */
    provideAvailableObjectsFromDocument(document: TextDocument): OmtAvailableObjects {
        const shorthands = this.contextPaths(document);
        return getAvailableObjectsFromDocument(document, shorthands);
    }

    /**
     * Resolve the target of a DocumentLink using its data.
     * @returns A string if the data could be related to a watched link target, such as a module declaration.
     * Returns undefined when unable to resolve the link with the specified data.
     * @param data the data from a document link
     */
    resolveLink(data?: DeclaredImportLinkData | unknown) {
        if (data && isDeclaredImportLinkData(data)) {
            return this.workspaceLookup.getModulePath(data.declaredImport.module);
        }
    }

    /**
     * Find all tsconfig files that apply to a given document
     * and compile a list of paths annotations defined in those configurations.
     * @param document the document that needs context.
     */
    private contextPaths(document: TextDocument) {
        const dirpathValue = dirpath(document.uri);
        return new Map<string, string>(this.tsConfigFiles
            // we need to filter for same parent because another config may have some of the same paths
            .filter(uri => dirpathValue.startsWith(uri.substring(0, uri.lastIndexOf('/'))))
            .reduce((paths: [string, string][], uri: string) => {
                try {
                    const file = readFileSync(uri, 'utf8');
                    const json = JSON.parse(file);
                    if (json.compilerOptions && json.compilerOptions.paths) {
                        // now make a path from the config folder to the keys value and map that
                        for (const key in json.compilerOptions.paths) {
                            const relPath = json.compilerOptions.paths[key].toString();
                            const newPath = resolve(dirname(uri), relPath);
                            paths.push([key.substring(0, key.lastIndexOf('/*')), newPath]);
                        }
                    }
                } catch (e) {
                    // need to catch this error for when there is a JSON parsing error for example
                    // we can still continue with other files
                    console.error(e);
                }
                return paths;
            }, []));
    }

    /**
     * Scan the document for imports/declarations/used objects and returns an OmtDocumentInformation object.
     * @param document the OMT file we are scanning
     * @param resolveShorthand function to resolve shorthand annotations at the start of import paths
     * @returns an OmtDocumentInformation object
     */
    private getOmtDocumentInformation(document: TextDocument, shorthands: Map<string, string>): OmtDocumentInformation {
        console.time('getOmtDocumentInformation for ' + document.uri);
        const documentLinks: DocumentLink[] = [];
        const calledObjects: OmtLocalObject[] = [];

        const documentText = document.getText();
        let fileImportsResult: OmtAvailableObjects | undefined;
        try {
            fileImportsResult = getAvailableObjectsFromDocument(document, shorthands);
        }
        catch (error) {
            if (error instanceof YAMLError) {
                console.log(error);
            } else {
                throw error;
            }
        }
        if (fileImportsResult) {
            const lines = documentText.split(newLine);
            const availableImports = fileImportsResult.availableImports;
            const definedObjects = fileImportsResult.definedObjects;
            lines.forEach((line, lineNumber) => {
                calledObjects.push(...getReferencesToOtherFilesForCode(availableImports, lineNumber, line));
                calledObjects.push(...getLocalLocationsForCode(definedObjects, lineNumber, line));
                documentLinks.push(...getDocumentImportLinks(availableImports, lineNumber, line));
            });
            console.timeEnd('getOmtDocumentInformation for ' + document.uri);
            return {
                documentLinks,
                definedObjects: fileImportsResult.definedObjects ?? [],
                calledObjects,
                availableImports: fileImportsResult.availableImports ?? []
            };
        } else {
            console.timeEnd('getOmtDocumentInformation for ' + document.uri);
            console.warn(`getOmtDocumentInformation for ${document.uri} failed with YAML errors`);
            return { documentLinks: [], definedObjects: [], calledObjects: [], availableImports: [] };
        }
    }
}

/**
 * A function that returns a list of Ranges where imports (reference to other files) are being used
 * @param fileImports a list of imports
 * @param lineNumber used for creating the Range object
 * @param line the string in where we going to search for used imports
 * @returns a list of OmtLocalObjects, containing all Ranges (with their names) where declared Objects are being used
 */
function getReferencesToOtherFilesForCode(fileImports: OmtImport[], lineNumber: number, line: string): OmtLocalObject[] {
    return findUsagesInLine(fileImports.map(x => x.name), lineNumber, line);
}

/**
 * A function that returns a list of Ranges where declared objects within a file are being used
 * @param declaredObjects a list of declared objects in the file
 * @param lineNumber used for creating the Range object
 * @param line the string in where we going to search for used imports
 * @returns a list of OmtLocalObjects, containing all Ranges (with their names) where declared Objects are being used
 */
function getLocalLocationsForCode(declaredObjects: OmtLocalObject[], lineNumber: number, line: string): OmtLocalObject[] {
    return findUsagesInLine(declaredObjects.map(x => x.name), lineNumber, line);
}

/**
 * A function that returns a list of DocumentLinks created for each import URL
 * @param fileImports a list of imports
 * @param lineNumber used for creating the Range object
 * @param line the string in where we going to search for used imports
 * @returns a list of DocumentLinks
 */
function getDocumentImportLinks(fileImports: OmtImport[], lineNumber: number, line: string): DocumentLink[] {
    const imports = fileImports.map(x => x.url);
    const results = findUsagesInLine(imports, lineNumber, line, true);
    return results.map(omtLocalObject => createDocumentLink(
        lineNumber,
        omtLocalObject,
        fileImports.find(x => omtLocalObject.name === x.url)?.fullUrl
    ));
}

/**
 * A function to find usages of declared objects in a specific line of code 
 * @param declaredObjects a list of declared objects
 * @param lineNumber used for creating the Range object
 * @param line the string in where we going to search for declaredObject
 * @param colonAllowed if false, the regex will search for declaredObjects that are not starting and not ending with a colon
 * @returns a list of OmtLocalObjects, containing all Ranges (with their names) where declared Objects are being used
 */
function findUsagesInLine(declaredObjects: string[], lineNumber: number, line: string, colonAllowed = false): OmtLocalObject[] {
    const documentLinks: OmtLocalObject[] = [];
    const optionalColon = colonAllowed ? '' : ':';
    const regex = (declaredObject: string) => new RegExp(`(?<=[^a-zA-Z0-9${optionalColon}]|^)${declaredObject}(?=[^a-zA-Z0-9${optionalColon}]|$)`);

    declaredObjects.filter(declaredObject => declaredObject && line.match(regex(declaredObject))).forEach(declaredObject => {
        const characterIndex = line.search(regex(declaredObject));

        if (characterIndex >= 0) {
            documentLinks.push({
                name: declaredObject,
                range: Range.create({ line: lineNumber, character: characterIndex }, { line: lineNumber, character: characterIndex + declaredObject.length })
            });
        }
    });
    return documentLinks;
}

/**
 * Create a DocumentLink linking to another document or to be resolved later.
 * @param line the line number within the document where the link should be
 * @param omtLocalObject the object where the link will be placed
 * @param uri the path to the document. leave undefined if the link will be resolved using the resolveDocumentLink request
 * @param data the data passed with the link when resolving it with the resolveDocumentLink request
 */
function createDocumentLink(line: number, omtLocalObject: OmtLocalObject, uri: string | undefined, data?: unknown): DocumentLink {
    const start = omtLocalObject.range.start.character;
    const length = omtLocalObject.name.length;
    const from = Position.create(line, start);
    const to = Position.create(line, start + length);
    const declaredImportModule = getDiMatch(omtLocalObject.name);
    if (declaredImportModule) {
        return DocumentLink.create(Range.create(from, to), undefined, {
            declaredImport: {
                module: declaredImportModule
            }
        });
    } else {
        return DocumentLink.create(Range.create(from, to), uri, data);
    }
}

/**
 * Used to export some functions that will be tested (but not exported for usage)
 */
export const exportedForTesting = {
    getDocumentImportLinks,
    getLocalLocationsForCode,
    getReferencesToOtherFilesForCode,
}