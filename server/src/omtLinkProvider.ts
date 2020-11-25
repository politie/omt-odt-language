import { dirname, isAbsolute, resolve } from 'path';
import { DocumentLink, Position, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { WorkspaceLookup } from './workspaceLookup';
import { DeclaredImportLinkData, isDeclaredImportLinkData } from './types';

const omtUriMatch = /( +["']?)(.*\.omt)/;
const declaredImportMatch = /( +)(?:module:)(.*):/;
const importMatch = /^import:/g;
const otherDeclareMatch = /^(\w+):/g;

/**
 * Provides DocumentLinks for the imports of an OMT file.
 */
export default class OMTLinkProvider {

    constructor(private workspaceLookup: WorkspaceLookup) { }

    /**
     * scan the document for imports and return DocumentLinks for
     * absolute paths,
     * relative paths,
     * paths starting with a shorthand ('@shorthand/relativePath'),
     * declared imports ('module: moduleName'). For declared imports the target will be undefined.
     * The declared import links can be resolved using the data and the `resolveLink` function.
     * @param document the document containing OMT
     */
    provideDocumentLinks(document: TextDocument): DocumentLink[] {
        // regular path links, with or without shorthands
        const shorthands = this.contextPaths(document);
        return findOMTUrl(document, (uri) => replaceStart(uri, shorthands));
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
        return new Map<string, string>(glob.sync('**/tsconfig**.json')
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
}

/**
 * returns all the text of a line in the provided document
 * @param document A text document with at least [line] amount of lines
 * @param line the line to be returned
 */
function getLine(document: TextDocument, line: number): string {
    return document.getText(Range.create(Position.create(line, 0), Position.create(line, Number.MAX_VALUE)));
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
 * scan the document for imports and return DocumentLinks for
 * absolute paths,
 * relative paths,
 * paths starting with a shorthand ('@shorthand/relativePath'),
 * declared imports ('module: moduleName'). For declared imports the target will be undefined.
 * The declared import links can be resolved using the data and the `resolveLink` function.
 * @param document the OMT file we are scanning
 * @param resolveShorthand function to resolve shorthand annotations at the start of import paths
 */
function findOMTUrl(document: TextDocument, resolveShorthand: (uri: string) => string): DocumentLink[] {
    const documentLinks: DocumentLink[] = [];
    // so match after import: until we need any other (\w+): without any preceding spaces
    let isScanning = false;
    for (let l = 0; l <= document.lineCount - 1; l++) {
        const line = getLine(document, l);
        if (importMatch.exec(line)) {
            isScanning = true; // start scannning lines for import paths after we enter an import block
        } else if (isScanning) {
            if (otherDeclareMatch.exec(line)) {
                break; // we can stop matching after the import block
            } else {
                const uriMatch = omtUriMatch.exec(line);
                const diMatch = declaredImportMatch.exec(line);
                if (uriMatch) {
                    // match[0] is the full match inluding the whitespace of match[1]
                    // match[1] is the whitespace and optional quotes. both of which we don't want to include in the linked text
                    // match[2] is the link text, including the @shorthands
                    const link = resolveShorthand(uriMatch[2].trim());
                    const url = isAbsolute(link) ? resolve(document.uri, link) : toAbsolutePath(document, link);
                    documentLinks.push(
                        createDocumentLink(l, uriMatch[1].length, uriMatch[2].length, url));
                }
                else if (diMatch) {
                    // match[0] is the full line match including the trailing colon
                    // match[1] is the whitespace prepending the import
                    // match[2] is the text 'module:'
                    // match[3] is the module name
                    const declaredImportModule = '' + diMatch[2];
                    // because the server may not be done scanning the workspace when this is called
                    // we will resolve the link after the user clicked on it by using the resolveDocumentLink functionality
                    // the url will be undefined and we pass the declared import information as data with the link
                    documentLinks.push(
                        createDocumentLink(l, diMatch[1].length, diMatch[0].length - diMatch[1].length, undefined, {
                            declaredImport: {
                                module: declaredImportModule,
                            }
                        }));
                }
            }
        }
    }
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
