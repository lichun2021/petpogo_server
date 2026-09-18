import { StringDecoder } from 'node:string_decoder'

// 只观察 event 行，不解析/记录 data，不改变转发字节；跨包残留最多 128 字符。
export function createStreamLogObserver(context: Record<string, any>) {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  context.proxySseDone = false
  return (chunk: Buffer) => {
    const lines = (pending + decoder.write(chunk)).split('\n')
    pending = lines.pop()!.slice(-128)
    for (const line of lines) {
      const match = /^event:\s*(done|error)\s*$/.exec(line)
      if (match?.[1] === 'done') context.proxySseDone = true
      if (match?.[1] === 'error') context.proxyOutcome = 'upstream_event_error'
    }
  }
}
