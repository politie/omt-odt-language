import { WorkspaceFolder, RemoteWorkspace, FileChangeType } from 'vscode-languageserver';
import * as fs from 'fs';
import path = require('path');

type scanOptions = {
    operators: { matcher: RegExp, exec: (uri: string, modules: Map<string, OMTModule>) => void }[],
    filters?: RegExp[]
}

type OMTModule = {
    name: string,
    uri: string,
}

/**
 * Tracks changes to the workspace and important files for core functionality of the language server
 */
export class WorkspaceLookup {
    private folders: Map<string, WorkspaceFolder>;
    private modules = new Map<string, OMTModule>();

    private readonly folderScanOptions: scanOptions = {
        operators: [
            { matcher: /(.omt)$/, exec: this.processOmtFile },
            // { matcher: /(package.json)$/, exec: (uri) => { console.log(`found config: ${uri}`) } }
        ],
        // TODO: make this a configuration item
        filters: [/(node_modules)/] // filter for scanning folders
    }

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

        workspace.connection.onDidChangeWatchedFiles(event => {
            event.changes.forEach(change => {
                if (change.uri.endsWith('.omt')) {
                    switch (change.type) {
                        case FileChangeType.Changed:
                            // process file?
                            break;
                        case FileChangeType.Created:
                        case FileChangeType.Deleted:
                        default:
                            break;
                    }
                }
            });
        });
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

    public scanForOMTModules(): void {
        // console.log('workspaceLookup.scanForOMTModules');
        this.folders.forEach(this.scanFolder);
    }

    private scanFolder(folder: WorkspaceFolder) {
        fromDir(folder.uri.substr(7), this.folderScanOptions, this.modules);
    }

    private processOmtFile(uri: string, modules: Map<string, OMTModule>) {
        // console.log(`found omt: ${uri}`);
        fs.readFile(uri, 'utf-8', (err, data) => {
            if (err) {
                console.error(`failed during reading ${uri}`, err);
                return;
            }

            const match = new RegExp(/^moduleName: (\w+)\s?$/, 'gm').exec(data);
            if (match) {
                const name = match[1];
                this.processModule(modules, name, uri);

            }
        })
    }

    private processModule(modules: Map<string, OMTModule>, name: string, uri: string) {
        const existing = modules.get(name);
        if (existing && existing.uri != uri) {
            console.warn(`There is another module named '${existing.name}' found at ${existing.uri}. Will now replace with ${uri}`);

            modules.set(name,
                {
                    name,
                    uri,
                });
        } else {
            modules.set(name,
                {
                    name,
                    uri,
                });
        }
    }

    getModuleUri(moduleName: string): string | undefined {
        const module = this.modules.get(moduleName);
        return module?.uri;
    }
}

/**
 * Scan the directory for files using the options as parameters
 * @param startPath the root path of the search
 * @param options options to adjust the search
 * @param modules module collection of the workspace (can be modified)
 */
function fromDir(startPath: string, options: scanOptions, modules: Map<string, OMTModule>) {
    // console.log('Starting from dir ' + startPath + '/');

    // TODO refactor so that modules does not need to be re-passed
    // TODO do this with glob
    if (!fs.existsSync(startPath)) {
        console.log("no dir ", startPath);
        return;
    }

    let shouldBeFiltered = false;
    options.filters?.forEach(filter => {
        if (filter.exec(startPath)) {
            shouldBeFiltered = true;
        }
    });
    if (shouldBeFiltered) {
        return;
    }

    var files = fs.readdirSync(startPath);
    for (var i = 0; i < files.length; i++) {
        var filename = path.join(startPath, files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            fromDir(filename, options, modules); //recurse
        }
        else {
            options.operators.forEach(op => {
                if (op.matcher.exec(filename)) {
                    op.exec(filename, modules);
                }
            });
        }
    };
};
