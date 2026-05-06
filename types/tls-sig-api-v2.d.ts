declare module 'tls-sig-api-v2' {
  class Api {
    constructor(sdkAppId: number, secretKey: string)
    genSig(identifier: string, expire: number): string
  }
  export { Api }
}
