
type OMTModule = {
    name: string,
    uri: string,
}

type CheckFileResult = {
    path: string,
} & CheckTextResult

type CheckTextResult = {
    isModule?: boolean,
    moduleName?: string,
}
