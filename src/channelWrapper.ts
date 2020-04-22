import { AmqpConnectionManager } from './connectionManager'
import { EventEmitter } from 'events'
import amqplib from 'amqplib'
import { neverThrows } from './helpers'

export type SetupFunc = (channel: amqplib.Channel) => Promise<any>

export interface AmqpChannelWrapperOptions {
  setup?: SetupFunc
}

export class AmqpChannelWrapper extends EventEmitter {
  #currentChannel: amqplib.ConfirmChannel | null
  #setup: SetupFunc[]

  constructor(connectionManager: AmqpConnectionManager, private options: AmqpChannelWrapperOptions) {
    super()
    this.#currentChannel = null
    this.#setup = []
    if (this.options.setup) {
      this.#setup.push(this.options.setup)
    }
    const { connection } = connectionManager
    if (connectionManager.isConnected() && connection) {
      this.onConnect(connection)
    }
    connectionManager.on('connect', this.onConnect.bind(this))
    connectionManager.on('disconnect', this.onDisconnect.bind(this))
  }

  private async onConnect(connection: amqplib.Connection) {
    try {
      const channel = await connection.createConfirmChannel()
      channel.on('close', this.onChannelClose.bind(this, channel))
      this.#currentChannel = channel
      await Promise.all(this.#setup.map((func) => func(channel)))
      return channel
    } catch (err) {
      this.emit('error', err)
    }
  }

  private onDisconnect() {
    this.#currentChannel = null
  }

  private onChannelClose(channel: amqplib.ConfirmChannel) {
    if (this.currentChannel === channel) {
      this.#currentChannel = null
    }
  }

  get currentChannel() {
    return this.#currentChannel
  }
}
