// 读取 Peer 资源信息。跳过完整字符串 token，将超长整数转字符串再解析。
// 不修改对 App 返回的 JSON，也不把字符串里的数字当作 JSON 数值。
export function parseResourceJson(text: string): any {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return JSON.stringify(token)
    return token
  }))
}

