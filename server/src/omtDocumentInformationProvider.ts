import { dirname, isAbsolute, resolve } from 'path';
import { DocumentLink, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { WorkspaceLookup } from './workspaceLookup';
import { DeclaredImportLinkData, isDeclaredImportLinkData, OmtAvailableObjects, OmtDocumentInformation, OmtImport, OmtLocalObject } from './types';
import { parse } from 'yaml';
import { YAMLError } from 'yaml/util';

const omtUriMatch = /( +["']?)(.*\.omt)/;
const declaredImportMatch = /( +)(?:module:)(.*):/;
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

function getUriMatch(line: string, document: TextDocument, shorthands: Map<string, string>) {
    const uriMatch = omtUriMatch.exec(line);
    if (uriMatch) {
        // match[0] is the full match inluding the whitespace of match[1]
        // match[1] is the whitespace and optional quotes. both of which we don't want to include in the linked text
        // match[2] is the link text, including the @shorthands
        const link = replaceStart(uriMatch[2].trim(), shorthands);
        const url = isAbsolute(link) ? resolve(document.uri, link) : toAbsolutePath(document, link);
        return { uriMatch, url };
    }
}

function getDiMatch(line: string) {
    const diMatch = declaredImportMatch.exec(line);
    if (diMatch) {
        // match[0] is the full line match including the trailing colon
        // match[1] is the whitespace prepending the import
        // match[2] is the module name
        const declaredImportModule = '' + diMatch[2];
        return { diMatch, declaredImportModule }
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
 * A function that can be used to retrieve all imported and declared objects (objects available to use)
 * @param document the TextDocument object
 * @param shorthands a list of shorthands that should be replaced by a full url
 * @returns an OmtAvailableObjects object, containing a list of imported objects and declared objects
 */
export function getAvailableObjectsFromDocument(document: TextDocument, shorthands?: Map<string, string>): OmtAvailableObjects {
    const documentText = document.getText();
    const yamlDocument = parse(document.getText());
    const availableImports: OmtImport[] = [];
    const definedObjects: OmtLocalObject[] = [];
    if ("import" in yamlDocument && shorthands) {
        const documentImports = yamlDocument["import"];
        const importUrls = Object.keys(documentImports);
        importUrls.forEach(importUrl => {
            const imports: string[] = documentImports[importUrl];
            const uriMatchResult = getUriMatch(' ' + importUrl, document, shorthands);
            if (uriMatchResult) {
                imports.forEach(importName => {
                    availableImports.push({ name: importName, url: importUrl, fullUrl: uriMatchResult.url });
                });
            }
        });
    }
    if ("queries" in yamlDocument) {
        definedObjects.push(...findDefinedObjects(yamlDocument["queries"], documentText, "QUERY"));
    }
    if ("commands" in yamlDocument) {
        definedObjects.push(...findDefinedObjects(yamlDocument["commands"], documentText, "COMMAND"));
    }
    if ("model" in yamlDocument) {
        const modelEntries = yamlDocument["model"];
        definedObjects.push(...findModelEntries(modelEntries, documentText));
        const keys = Object.keys(modelEntries);
        keys.forEach(key => {
            const entry = modelEntries[key];

            if ("commands" in entry) {
                definedObjects.push(...findDefinedObjects(entry["commands"], documentText, "COMMAND"));
            }

            if ("queries" in entry) {
                definedObjects.push(...findDefinedObjects(entry["queries"], documentText, "QUERY"));
            }
        });
    }
    return { availableImports, definedObjects };
}

/**
 * A function to get all declared activities/procedures etc.
 * @param modelEntries the result of yamlDocument["model"]
 * @param documentText the text of the document, used to find the line numbers
 * @returns A list of OmtLocalObject with the range where the declared object can be found in the document
 */
function findModelEntries(modelEntries: Object, documentText: string): OmtLocalObject[] {
    const localDefinedObjects: OmtLocalObject[] = [];
    const keys = Object.keys(modelEntries);
    keys.forEach(key => {
        const range = findRangeWithRegex(documentText, new RegExp(`(${key})(?=: !)`));
        localDefinedObjects.push({ name: key, range });
    });
    return localDefinedObjects;
}

/**
 * A function to get all declared objects in ODT code
 * @param value a piece of text that contains (multiline) ODT code
 * @param documentText the text of the document, used to find the line numbers
 * @param define the thing we define, something like QUERY or COMMAND
 * @returns A list of OmtLocalObject with the range where the declared object can be found in the document
 */
function findDefinedObjects(value: string, documentText: string, define: string): OmtLocalObject[] {
    const localDefinedObjects: OmtLocalObject[] = [];
    const queriesRegex = new RegExp(`(?<=DEFINE ${define} )([a-zA-Z0-9]+)`, "gm");
    const definedQueries = value.match(queriesRegex);
    definedQueries && definedQueries.forEach(q => {
        const rangeForQuery = findRangeWithRegex(documentText, new RegExp(`(?<=DEFINE ${define} )(${q})(?=[^a-zA-Z0-9])`, "gm"))
        localDefinedObjects.push({ name: q, range: rangeForQuery })
    });

    return localDefinedObjects;
}

/**
 * This function assumes that the regex is found only once in the document, and returns the Range where it can be found.
 * @param documentText the text of the document, used to find the line numbers
 * @param regex the regex which we are trying to find
 * @returns A range where the regex can be found, or an error if the regex is found zero or more than one times.
 */
function findRangeWithRegex(documentText: string, regex: RegExp): Range {
    const lines = documentText.split(/\r?\n/);
    const ranges: Range[] = [];

    lines.forEach((line, i) => {
        const result = line.match(regex);
        if (result) {
            const name = result[0];
            const index = line.indexOf(name);
            ranges.push(Range.create({ line: i, character: index }, { line: i, character: index + name.length }));
        }
    });

    if (ranges.length !== 1) {
        throw new Error(`${ranges.length} results found for ${regex}, expected only one.`);
    }

    return ranges[0];
}

/**
 * Makes an absolute path based on a link relative to a document
 * @param document The document the link is relative to
 * @param link a relative path from the document
 */
function toAbsolutePath(document: TextDocument, link: string): string {
    return resolve(dirpath(document.uri), link)
}

/**
 * Convert the uri to a path to a directory and make sure it does not start with `file://`
 * @param uri path to be made into a dirpath
 */
function dirpath(uri: string): string {
    uri = dirname(uri);
    return uri.startsWith('file:') ? uri.substr(7) : uri;
}

/**
 * Replace the start of the uri with the mapped value if it starts with a shorthand, otherwise returns the same path.
 * @param uri the path that may start with a shorthand
 * @param shorthands a mapping of shorthands to the paths they represent
 */
function replaceStart(uri: string, shorthands: Map<string, string>): string {
    shorthands.forEach((value, key) => {
        if (uri.startsWith(key)) {
            uri = uri.substr(key.length);
            uri = resolve(value.substr(0, osNeutralLastSlashIndex(value)), '.' + uri);
        }
    });
    return uri;
}

/**
 * Find the last index of the slash*.
 * @param path path we want to find the last slash of
 */
function osNeutralLastSlashIndex(path: string): number {
    const unixIndex = path.lastIndexOf('/*');
    return unixIndex >= 0 ? unixIndex : path.lastIndexOf('\\*');
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
    getUriMatch,
    findDefinedObjects,
    findRangeWithRegex,
}