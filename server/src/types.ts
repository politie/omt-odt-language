
export type OMTModule = {
    name: string,
    uri: string,
}

export type CheckFileResult = {
    path: string,
} & CheckTextResult

export type CheckTextResult = {
    module?: {
        name: string,
    },
}
