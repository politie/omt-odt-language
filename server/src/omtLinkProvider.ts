import { dirname, isAbsolute, resolve } from 'path';
import { DocumentLink, Position, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { WorkspaceLookup } from './workspaceLookup';

const omtUriMatch = /( +["']?)(.*\.omt)/;
const declaredImportMatch = /( +)(module:)(.*):/;
const importMatch = /^import:/g;
const otherDeclareMatch = /^(\w+):/g;

/**
 * Provides DocumentLinks for the imports of an OMT file.
 */
export default class OMTLinkProvider {

    constructor(private workspaceLookup: WorkspaceLookup) { }

    provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        // console.log('server omtLinkProvider.provideDocumentLinks');

        // regular path links, with or without shorthands
        const shorthands = this.contextPaths(document);
        const documentLinks: DocumentLink[] = findOMTUrl(document, (uri) => replaceStart(uri, shorthands), this.workspaceLookup);

        // declared imports
        /** TODO for declared imports
         * when no apropriate module can be found give a tooltip
         */
        return Promise.resolve(documentLinks ? documentLinks : []);
    }

    /**
     * Resolve the target of a DocumentLink using its data. Returns undefined when unable to resolve
     * @param data the data from a document link
     */
    public resolve(data?: any) {
        // console.log(`omtLinkProvider.resolve ${data.isDeclaredImport} ${data.module}`)
        if (data && data.isDeclaredImport) {
            return this.workspaceLookup.getModulePath(data.module);
        }
    }

    private contextPaths(document: TextDocument) {
        const pathPaths = glob.sync('**/tsconfig**.json')
            // we need to filter for same parent because another config may have some of the same paths
            .filter(uri => document.uri.startsWith(uri.substr(0, uri.lastIndexOf('/'))))
            .map(uri => {
                const file = readFileSync(uri, 'utf8');
                try {
                    const json = JSON.parse(file);
                    if (json.compilerOptions && json.compilerOptions.paths) {
                        // now make a path from the config folder to the keys value and map that
                        const paths: [string, string][] = [];
                        for (let key in json.compilerOptions.paths) {
                            const relPath = json.compilerOptions.paths[key].toString();
                            const newPath = resolve(dirname(uri), relPath);
                            paths.push([key.substr(0, key.lastIndexOf('/*')), newPath]);
                        }
                        return paths;
                    }
                } catch (e) { console.error(); }
                // all other paths return undefined
            }).filter(paths => paths != undefined) as {} as [string, string][];
        // make it typed
        const sourceType: [string, string][] = [];
        const mapSource = sourceType.concat.apply([], pathPaths);
        return new Map<string, string>(mapSource);
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
 * Convert the uri to a path to a directory and make sure it does not start with file:
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
            uri = resolve(value.substr(0, value.lastIndexOf('/*')), '.' + uri);
        }
    });
    return uri;
}

/**
 * Find links to other imported OMT files
 * @param document the OMT file we are scanning
 * @param resolveShorthand function to resolve shorthand annotations at the start of import paths
 */
function findOMTUrl(document: TextDocument, resolveShorthand: (uri: string) => string, workspaceLookup: WorkspaceLookup): DocumentLink[] {
    // console.log('server omtLinkProvider.findOMTUrl');
    let documentLinks: DocumentLink[] = [];
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
                    let link = resolveShorthand(uriMatch[2].trim());

                    let url: string;
                    if (isAbsolute(link)) {
                        url = resolve(document.uri, link);
                    } else {
                        url = toAbsolutePath(document, link);
                    }
                    documentLinks.push(
                        createDocumentLink(l, uriMatch[1].length, uriMatch[2].length, url));
                }
                else if (diMatch) {
                    // match[0] is the full line match including the trailing colon
                    // match[1] is the whitespace prepending the import
                    // match[2] is the text 'module:'
                    // match[3] is the module name
                    const declaredImportModule = '' + diMatch[3];
                    const moduleUri = workspaceLookup.getModulePath(declaredImportModule);
                    // because the server may not be done scanning the workspace when this is called
                    // we will resolve the link after the user clicked on it by using the resolveDocumentLink functionality
                    // the url will be undefined and we pass the declared import information as data with the link
                    documentLinks.push(
                        createDocumentLink(l, diMatch[1].length, diMatch[0].length - diMatch[1].length, undefined, {
                            isDeclaredImport: true,
                            module: declaredImportModule,
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
function createDocumentLink(line: number, start: number, length: number, uri: string | undefined, data?: any): DocumentLink {
    const from = Position.create(line, start);
    const to = Position.create(line, start + length);
    return DocumentLink.create(Range.create(from, to), uri, data);
}
