import { AmqpConnectionManager } from './connectionManager'
import { EventEmitter } from 'events'
import amqplib, { Replies } from 'amqplib'

export type SetupFunc = (channel: amqplib.Channel) => Promise<any>

export interface AmqpChannelWrapperOptions {
  setup?: SetupFunc
}

export class AmqpChannelWrapper extends EventEmitter {
  #currentChannel: amqplib.ConfirmChannel | null
  setup: SetupFunc[]

  constructor(private connectionManager: AmqpConnectionManager, private options: AmqpChannelWrapperOptions) {
    super()
    this.#currentChannel = null
    this.setup = []

    if (this.options.setup) {
      this.setup.push(this.options.setup)
    }

    const { currentConnection } = this.connectionManager
    this.connectionManager.on('connect', (connection) => this.createChannel(connection))
    this.connectionManager.on('close', () => this.onConnectionClose())

    if (this.connectionManager.isConnected() && currentConnection) {
      this.createChannel(currentConnection)
    }
  }

  private createChannel(connection: amqplib.Connection) {
    return connection
      .createConfirmChannel()
      .then((channel) => {
        return Promise.all(this.setup.map((func) => func(channel))).then(() => {
          this.#currentChannel = channel
          this.emit('create')
        })
      })
      .catch((err) => {
        this.#currentChannel = null
        this.emit('error', err)
      })
  }

  public publish(exchange: string, routingKey: string, content: Buffer, options?: amqplib.Options.Publish) {
    return new Promise((resolve, reject) => {
      if (this.currentChannel) {
        this.currentChannel.publish(exchange, routingKey, content, options, (err: any, ok: Replies.Empty) => {
          if (err) return reject(err)
          return resolve(ok)
        })
      } else return reject(new Error('Current channel is null'))
    })
  }

  public sendToQueue(queue: string, content: Buffer, options?: amqplib.Options.Publish | undefined) {
    return new Promise((resolve, reject) => {
      if (this.currentChannel) {
        this.currentChannel.sendToQueue(queue, content, options, (err: any, ok: Replies.Empty) => {
          if (err) return reject(err)
          return resolve(ok)
        })
      } else return reject(new Error('Current channel is null'))
    })
  }

  public ack(message: amqplib.Message, allUpTo?: boolean | undefined): void | undefined {
    return this.currentChannel?.ack(message, allUpTo)
  }

  public ackAll(): void | undefined {
    return this.currentChannel?.ackAll()
  }

  public nack(message: amqplib.Message, allUpTo?: boolean | undefined, requeue?: boolean | undefined): void | undefined {
    return this.currentChannel?.nack(message, allUpTo, requeue)
  }

  public nackAll(requeue?: boolean | undefined): void | undefined {
    return this.currentChannel?.nackAll(requeue)
  }

  private onConnectionClose() {
    this.#currentChannel = null
  }

  get currentChannel() {
    return this.#currentChannel
  }
}
