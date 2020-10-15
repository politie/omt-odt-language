import { WorkspaceFolder, RemoteWorkspace, FileChangeType, TextDocumentChangeEvent, combineConsoleFeatures, DidChangeWatchedFilesParams } from 'vscode-languageserver';
import { readFile } from 'fs';
import { glob } from 'glob';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseOmtFile, parseOmtText } from './omtFileParser';

// TODO refactor/add options to glob, so that the .subs

/**
 * Tracks changes to the workspace and important files for core functionality of the language server
 */
export class WorkspaceLookup {
    private folders: Map<string, WorkspaceFolder>;
    private modules = new Map<string, OMTModule>();
    private readonly omtPattern = '**/*.omt';

    /**
     *
     * @param workspace workspace of the client
     */
    constructor(workspace: RemoteWorkspace) {
        this.folders = new Map<string, WorkspaceFolder>();

        workspace.getWorkspaceFolders().then((folders) => {
            if (folders) {
                folders.forEach(folder => this.addFolder(folder));
            }
        });

        workspace.onDidChangeWorkspaceFolders(event => {
            event.added.forEach(folder => this.addFolder(folder));
            event.removed.forEach(folder => this.removeFolder(folder));
        });

        workspace.connection.onDidChangeWatchedFiles((params) => this.watchedFilesChanged(params));
    }

    watchedFilesChanged(event: DidChangeWatchedFilesParams) {
        // console.log(`workspaceLookup.watchedFilesChanged ${event.changes.length}`);
        // when a file watched by the client is changed even when it isn't open in the editor (by version control for example)
        // this only happens with saved files and the changes should be read from the filesystem
        event.changes.forEach(change => {
            if (change.uri.endsWith('.omt')) {
                switch (change.type) {
                    case FileChangeType.Changed:
                        parseOmtFile(change.uri.substr(7))
                            .then((result) => this.checkForChanges(result))
                            .catch(reason => {
                                console.error(`while parsingOmtFile ${change.uri} something went wrong: ${reason}`);
                            });
                        break;
                    case FileChangeType.Created:
                    case FileChangeType.Deleted:
                    default:
                        break;
                }
            }
        });
    }

    fileChanged(change: TextDocumentChangeEvent<TextDocument>) {
        // these changes will be called for each little edit in the document
        // the event will fire before the change has been saved to file.
        // Therefore we need the text from the change.document
        this.checkForChanges({
            path: change.document.uri.substr(7),
            ...parseOmtText(change.document.getText())
        });
    }


    private checkForChanges(result: CheckFileResult) {
        if (result.isModule) {
            // console.log(`result.isModule ${result.moduleName}`);
            const module = this.modules.get(result.moduleName!);
            if (!module) {
                // console.log('did not find it')
                this.modules.forEach((value, key) => {
                    // console.log(`check: ${value.uri} || ${result.path}`);
                    if (value.uri == result.path) {
                        // console.log('did find one with the same path')
                        this.modules.delete(key);
                    }
                });
            }
            this.processModule(result);
        }
    }

    public addFolder(folder: WorkspaceFolder) {
        // console.log(`workspaceLookup.addFolder ${folder.name}`);
        if (this.folders.get(folder.uri)) {
            console.error('workspace folder was already added');
            throw new Error('workspace folder was already added');
        }
        else {
            this.folders.set(folder.uri, folder);
            this.scanFolder(folder);
        }
    }

    public removeFolder(folder: WorkspaceFolder) {
        if (!this.folders.delete(folder.uri)) {
            console.error('workspace folder was already removed');
            throw new Error('workspace folder was already removed')
        }
        // remove the modules of the removed folder
        this.modules.forEach(module => {
            if (module.uri.startsWith(module.uri)) {
                this.modules.delete(module.name);
            }
        });
    }

    /**
     * Check all omt files in the workspace for modules
     */
    public scanForOMTModules(): void {
        // console.log('workspaceLookup.scanForOMTModules');
        this.folders.forEach(this.scanFolder);
    }

    /**
     * scan a directory and all its subdirectories for omt files
     * @param folder the folder which contents will be searched for omt files
     */
    private scanFolder(folder: WorkspaceFolder) {
        // we need to remove the first 7 character (file://) to make the pattern work
        glob(`${folder.uri.substr(7)}/${this.omtPattern}`, (err, files) => {
            if (err) {
                console.error('While executing glob, scanning for omt files', err);
            } else {
                for (var i = 0; i < files.length; i++) {
                    this.processOmtFile(files[i]);
                };
            }
        });
    }

    private processOmtFile(uri: string) {
        // console.log(`workspaceLookup.processOmtFile: ${uri}`);
        parseOmtFile(uri).then((result) => {
            if (result.isModule) {
                this.processModule(result);
            }
        }).catch(reason => {
            console.error(reason);
        })
    }

    private processModule(fileResult: CheckFileResult) {
        const { moduleName: name, path: uri } = fileResult;
        if (!name) {
            throw new Error('name is undefined');
        }
        // console.log(`workspaceLookup.processModule ${name}`);
        const existing = this.modules.get(name);
        if (existing && existing.uri != uri) {
            console.warn(`WARN: There is another module named '${existing.name}' found at ${existing.uri}. Will now replace with ${uri}`);

            this.modules.set(name,
                {
                    name,
                    uri,
                });
        } else {
            this.modules.set(name,
                {
                    name,
                    uri,
                });
        }
    }

    /**
     * Gets the path to the file containing an omt module with the specified name. returns undefined if the module could not be found.
     * @param name the name of the module
     */
    getModulePath(name: string): string | undefined {
        const module = this.modules.get(name);
        return module?.uri;
    }
}

