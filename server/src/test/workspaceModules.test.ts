import { expect } from "chai";
import { stub } from "sinon";
import { CheckFileResult, OMTModule } from "../types";
import { WorkspaceModules } from "../workspaceModules";


describe('WorkspaceModule', () => {
    let workspaceModules: WorkspaceModules;
    let defaultCheckFileResult: CheckFileResult;
    beforeEach(() => {
        workspaceModules = new WorkspaceModules();
        defaultCheckFileResult = {
            path: 'folder/defaultPath.omt',
            module: {
                name: 'defaultModule',
            }
        };
    });

    describe('checkForChanges', () => {
        it('should ignore a result that is not a module', () => {
            workspaceModules.checkForChanges({
                ...defaultCheckFileResult,
                module: undefined
            });
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('should create a module when the name is new', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq(defaultCheckFileResult.path);
        });

        it('should replace an existing module with the same name but a different path', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.checkForChanges({
                ...defaultCheckFileResult,
                path: 'otherPath.omt'
            });
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq('otherPath.omt');
        });

        it('should replace the module when there is one with the same name and uri', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            const setStub = stub(workspaceModules.modules, 'set');
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq(defaultCheckFileResult.path);
            expect(setStub).to.be.calledOnceWith(defaultCheckFileResult.module?.name!, {
                name: defaultCheckFileResult.module?.name!,
                uri: defaultCheckFileResult.path
            });
        });

        it('should warn when there is another module with the same name in a different file', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            const warnStub = stub(console, 'warn');
            const differentPath = 'folder/differentPath.omt';
            workspaceModules.checkForChanges({
                ...defaultCheckFileResult,
                path: differentPath,
            });
            expect(warnStub).to.be.calledOnce;
            expect(warnStub.firstCall.firstArg).to.contain(defaultCheckFileResult.module?.name);
            expect(warnStub.firstCall.firstArg).to.contain(defaultCheckFileResult.path);
            expect(warnStub.firstCall.firstArg).to.contain(differentPath);
            warnStub.restore();
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq(differentPath);
        });

        it('should remove a module when the contents no longer have a module definition', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.checkForChanges({
                ...defaultCheckFileResult,
                module: undefined
            });
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('should not remove a module when another omt is checked', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.checkForChanges({
                path: 'some/otherPath.omt'
            });
            expect(workspaceModules.modules.size).to.eq(1);
        })
    });

    describe('getModulePath', () => {
        beforeEach(() => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
        });

        it('should return undefined when there is no module with that name', () => {
            const result = workspaceModules.getModulePath('otherName');
            expect(result).to.be.undefined
        });

        it('should return the path of the module if it is in the workspace', () => {
            const result = workspaceModules.getModulePath(defaultCheckFileResult.module?.name!);
            expect(result).to.eq(defaultCheckFileResult.path);
        });
    });

    describe('removeFolder', () => {
        beforeEach(() => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
        });

        it('should remove any module in the folder', () => {
            workspaceModules.removeFolder('folder/');
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('should ignore any module in another folder', () => {
            workspaceModules.removeFolder('otherFolder/');
            expect(workspaceModules.modules.size).to.eq(1);
        });
    });

    describe('removeFile', () => {
        beforeEach(() => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
        });

        it('removes a module with matching uri', () => {
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.removeFile(defaultCheckFileResult.path);
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('ignores a module without matching uri', () => {
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.removeFile('./some/other/path.omt');
            expect(workspaceModules.modules.size).to.eq(1);
        });
    });

});
