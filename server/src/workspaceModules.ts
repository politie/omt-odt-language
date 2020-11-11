
export interface WorkspaceProcessor {
    readonly extention: string;
    checkForChanges: (result: CheckFileResult) => void;
    removeFolder: (uri: string) => void;
}

export class WorkspaceModules implements WorkspaceProcessor {
    public readonly extention = '.omt';
    /**
     * modules, keyed by name
     */
    public modules = new Map<string, OMTModule>();

    public checkForChanges(result: CheckFileResult) {
        if (result.isModule) {
            const module = this.modules.get(result.moduleName!);
            if (!module) {
                this.modules.forEach((value, key) => {
                    if (value.uri == result.path) {
                        this.modules.delete(key);
                    }
                });
            }
            this.processModule(result);
        } else {
            // remove if this file was considered a module and now no longer matches
            this.modules.forEach(module => {
                if (module.uri === result.path) {
                    this.modules.delete(module.name);
                }
            })
        }
    }

    private processModule(fileResult: CheckFileResult) {
        const { moduleName: name, path: uri } = fileResult;
        if (!name) {
            throw new Error('name is undefined');
        }
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

    getModulePath(name: string): string | undefined {
        const module = this.modules.get(name);
        return module?.uri;
    }

    removeFolder(uri: string) {
        this.modules.forEach(module => {
            if (module.uri.startsWith(uri)) {
                this.modules.delete(module.name);
            }
        });
    }

    removeFile(uri: string) {
        this.modules.forEach(module => {
            if (module.uri == uri) {
                this.modules.delete(module.name);
            }
        });
    }
}
