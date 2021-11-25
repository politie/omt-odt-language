import { dirname, resolve } from 'path';
import { DocumentLink, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { WorkspaceLookup } from './workspaceLookup';
import { DeclaredImportLinkData, isDeclaredImportLinkData, OmtAvailableObjects, OmtDocumentInformation, OmtImport, OmtLocalObject } from './types';
import { YAMLError } from 'yaml/util';
import { getDiMatch, getUriMatch } from './importMatch';
import { getAvailableObjectsFromDocument } from './omtAvailableObjectsProvider';

const importMatch = /^import:/g;
const otherDeclareMatch = /^(\w+):/g;

/**
 * Provides DocumentLinks for the imports of an OMT file.
 */
export default class OmtDocumentInformationProvider {

    private tsConfigFiles = glob.sync('**/tsconfig**.json');

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
        return new Map<string, string>(this.tsConfigFiles
            // we need to filter for same parent because another config may have some of the same paths
            .filter(uri => document.uri.startsWith(uri.substr(0, uri.lastIndexOf('/'))))
            .reduce((paths: [string, string][], uri: string) => {
                try {
                    const file = readFileSync(uri, 'utf8');
                    const json = JSON.parse(file);
                    if (json.compilerOptions && json.compilerOptions.paths) {
                        // now make a path from the config folder to the keys value and map that
                        for (const key in json.compilerOptions.paths) {
                            const relPath = json.compilerOptions.paths[key].toString();
                            const newPath = resolve(dirname(uri), relPath);
                            paths.push([key.substr(0, key.lastIndexOf('/*')), newPath]);
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
        // check all lines between 'import:' and another '(\w+):' (without any preceding spaces)
        let isScanning = false;
        const documentText = document.getText();
        let fileImportsResult;
        try {
            fileImportsResult = getAvailableObjectsFromDocument(document, shorthands);
        }
        catch (error) {
            if (error instanceof YAMLError) {
                console.log(error);
            }
            else {
                throw error;
            }
        }
        const lines = documentText.split(/\r?\n/);
        for (let l = 0; l <= lines.length - 1; l++) {
            const line = lines[l];
            if (importMatch.exec(line)) {
                isScanning = true; // start scannning lines for import paths after we enter an import block
            } else if (isScanning) {
                if (otherDeclareMatch.exec(line)) {
                    isScanning = false;
                } else {
                    const uriMatchResult = getUriMatch(line, document, shorthands);
                    const diMatchResult = getDiMatch(line);
                    if (uriMatchResult) {
                        // match[0] is the full match inluding the whitespace of match[1]
                        // match[1] is the whitespace and optional quotes. both of which we don't want to include in the linked text
                        // match[2] is the link text, including the @shorthands
                        documentLinks.push(
                            createDocumentLink(l, uriMatchResult.uriMatch[1].length, uriMatchResult.uriMatch[2].length, uriMatchResult.url));
                    }
                    else if (diMatchResult) {
                        // match[0] is the full line match including the trailing colon
                        // match[1] is the whitespace prepending the import
                        // match[2] is the module name
                        // because the server may not be done scanning the workspace when this is called
                        // we will resolve the link after the user clicked on it by using the resolveDocumentLink functionality
                        // the url will be undefined and we pass the declared import information as data with the link
                        documentLinks.push(
                            createDocumentLink(l, diMatchResult.diMatch[1].length, diMatchResult.diMatch[0].length - diMatchResult.diMatch[1].length, undefined, {
                                declaredImport: {
                                    module: diMatchResult.declaredImportModule,
                                }
                            }));
                    }
                    else if (fileImportsResult) {
                        calledObjects.push(...getReferencesToOtherFilesForCode(fileImportsResult.availableImports, l, line));
                    }
                }
            }
            else if (fileImportsResult) {
                calledObjects.push(...getReferencesToOtherFilesForCode(fileImportsResult.availableImports, l, line));
                calledObjects.push(...getLocalLocationsForCode(fileImportsResult.definedObjects, l, line));
            }
        }
        console.timeEnd('getOmtDocumentInformation for ' + document.uri);
        return {
            documentLinks,
            definedObjects: fileImportsResult?.definedObjects ?? [],
            calledObjects,
            availableImports: fileImportsResult?.availableImports ?? []
        };
    }
}

function getReferencesToOtherFilesForCode(fileImports: OmtImport[], l: number, line: string): OmtLocalObject[] {
    return findUsagesInLine(fileImports.map(x => x.name), l, line);
}

function getLocalLocationsForCode(declaredObjects: OmtLocalObject[], l: number, line: string): OmtLocalObject[] {
    return findUsagesInLine(declaredObjects.map(x => x.name), l, line);
}

/**
 * A function to find usages of declared objects in a specific line of code 
 * @param declaredObjects a list of declared objects
 * @param lineNumber used for creating the Range object
 * @param line the string in where we going to search for declaredObject
 * @returns a list of OmtLocalObjects, containing all Ranges (with their names) where declared Objects are being used
 */
function findUsagesInLine(declaredObjects: string[], lineNumber: number, line: string): OmtLocalObject[] {
    const documentLinks: OmtLocalObject[] = [];
    const regex = (declaredObject: string) => new RegExp(`${declaredObject}(?=[^a-zA-Z0-9]|$)`);

    declaredObjects.filter(declaredObject => line.match(regex(declaredObject))).forEach(declaredObject => {
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
 * @param start the start position on the line
 * @param length the length of the text representing the link
 * @param uri the path to the document. leave undefined if the link will be resolved using the resolveDocumentLink request
 * @param data the data passed with the link when resolving it with the resolveDocumentLink request
 */
function createDocumentLink(line: number, start: number, length: number, uri: string | undefined, data?: unknown): DocumentLink {
    const from = Position.create(line, start);
    const to = Position.create(line, start + length);
    return DocumentLink.create(Range.create(from, to), uri, data);
}

/**
 * Used to export some functions that will be tested (but not exported for usage)
 */
export const exportedForTesting = {
    getLocalLocationsForCode,
    getReferencesToOtherFilesForCode,
}