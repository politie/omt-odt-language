
import * as path from 'path';
import { DocumentLink, DocumentLinkProvider, TextDocument } from 'vscode';
import { Position, Range, Uri, workspace } from 'vscode';
import { readFileSync } from 'fs';

const MATCHER = /( {4}["']?)(.*\.omt)/;
const importMatch = /^import:/g;
const otherDeclareMatch = /^(\w+):/g;

// Geeft een set zogenaamde DocumentLinks terug die VSCode in de editor toont.
export default class OMTLinkProvider implements DocumentLinkProvider {

    constructor() {
    }

    public provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {

        return Promise.resolve(workspace.findFiles('**/tsconfig**.json').then(
            (tsConfigs) => {
                const pathPaths = tsConfigs
                    // we need to filter for same parent because another config may have some of the same paths
                    .filter(uri => document.fileName.startsWith(uri.path.substr(0, uri.path.lastIndexOf('/'))))
                    .map(uri => {
                        const file = readFileSync(uri.path, 'utf8');
                        try {
                            const json = JSON.parse(file);
                            if (!!(json.compilerOptions) && !!(json.compilerOptions.paths)) {
                                // now make  a path from the config folder to the keys value and map that
                                const paths: [string, string][] = [];
                                for (var key in json.compilerOptions.paths) {
                                    const relPath = json.compilerOptions.paths[key].toString();
                                    const newPath = path.resolve(path.dirname(uri.path), relPath);
                                    paths.push([key.substr(0, key.lastIndexOf('/*')), newPath]);
                                }
                                return paths;
                            }
                        } catch (e) { console.error(); }
                        // all other paths return undefined
                    }).filter(paths => paths != undefined);
                //make it typed
                const sourceType: [string, string][] = [];
                const mapSource = sourceType.concat.apply([], pathPaths) as [string, string][];
                return new Map<string, string>(mapSource);
            }

        ).then(nroots => {
            const DocumentLinks: DocumentLink[] = findOMTUrl(document, nroots);
            return Promise.resolve(DocumentLinks ? DocumentLinks : []);
        }));
    }
}

// Loop door de regels van een OMT bestand en zoek links naar andere OMT bestanden
function findOMTUrl(document: TextDocument, roots: Map<string, string>): DocumentLink[] {
    let _DocumentLinks: DocumentLink[] = [];
    // so match after import: until we need any other (\w+): without any preceding spaces
    let isScanning = false;
    for (let l = 0; l <= document.lineCount - 1; l++) {
        const line = document.lineAt(l);

        if (importMatch.exec(line.text)) {
            isScanning = true;
        } else if (isScanning) {
            if (otherDeclareMatch.exec(line.text)) {
                break; // we can stop matching after the import block 
            } else {
                const match = MATCHER.exec(line.text);
                if (match) {
                    // match[0] is the full match inluding the whitespace of match[1]
                    // match[1] is the whitespace and optional quotes. both of which we don't want to include in the linked text
                    // match[2] is the link text, including the @shorthands
                    let link = match[2].trim();
                    const start = new Position(line.lineNumber, match[1].length);
                    const end = start.translate(0, match[2].length);

                    roots.forEach((value, key) => {
                        if (link.startsWith(key)) {
                            link = link.substr(key.length);
                            link = path.resolve(value.substr(0, value.lastIndexOf('/*')), '.' + link);
                        }
                    })

                    // Maak een lege Uri aan om later een relative path in te stoppen.
                    let url = Uri.file('');

                    url = url.with({
                        scheme: 'file',
                        path: path.resolve(path.dirname(document.fileName), link)
                    });

                    _DocumentLinks.push(new DocumentLink(new Range(start, end), url));
                }
            }
        }

        if (l === document.lineCount) {
            break;
        }
    }
    return _DocumentLinks;
}