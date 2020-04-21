export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay))

export const neverThrows = (err: any) =>
  setImmediate(() => {
    throw new Error(`AmqpConnectionManager - should never get here: ${err.message}\n` + err.stack)
  })
