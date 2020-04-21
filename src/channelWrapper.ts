import { AmqpConnectionManager } from './connectionManager'
import { EventEmitter } from 'events'
import amqplib from 'amqplib'

export type SetupFunc = (channel: amqplib.Channel) => Promise<any>

export interface AmqpChannelWrapperOptions {
  setup?: SetupFunc
}

export class AmqpChannelWrapper extends EventEmitter {
  #currentChannel: amqplib.Channel | null
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
    connectionManager.on('connect', this.onConnect)
    connectionManager.on('disconnect', this.onDisconnect)
  }

  private onConnect = async (connection: amqplib.Connection): Promise<any> => {
    try {
      const channel = await connection.createConfirmChannel()
      channel.on('close', () => this.onChannelClose(channel))
      this.#currentChannel = channel
      await Promise.all(
        this.#setup.map((func) =>
          func(channel).catch((err) => {
            if (this.#currentChannel) {
              this.emit('error', err)
            }
          })
        )
      )
    } catch (err) {
      this.emit('error', err)
    }
  }

  private onDisconnect = () => {
    this.#currentChannel = null
  }

  private onChannelClose = (channel: amqplib.Channel) => {
    if (this.#currentChannel === channel) {
      this.#currentChannel = null
    }
  }
}
