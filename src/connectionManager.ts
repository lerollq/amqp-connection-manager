import amqplib from 'amqplib'
import { EventEmitter } from 'events'
import { sleep, neverThrows } from './helpers'
import { AmqpChannelWrapper, AmqpChannelWrapperOptions } from './channelWrapper'

export const DEFAULT_RECONNECTION_DELAY = 5000 // In milliseconds

export interface ConnectionOptions {
  url: string | amqplib.Options.Connect
  socketOptions?: any
  reconnectionDelay?: number
}

export class AmqpConnectionManager extends EventEmitter {
  #currentConnection: amqplib.Connection | null
  #channels: AmqpChannelWrapper[]
  #options: ConnectionOptions
  constructor(options: ConnectionOptions) {
    super()
    this.#currentConnection = null
    this.#options = options
    this.#channels = []

    this.connect()
  }

  public createChannel = (options: AmqpChannelWrapperOptions) => {
    const channel = new AmqpChannelWrapper(this, options)
    channel.once('close', () => {
      this.#channels = this.#channels.filter((chann) => chann !== channel)
    })
    this.#channels.push(channel)
    return channel
  }

  public isConnected = () => {
    return !!this.#currentConnection
  }

  private async connect(): Promise<amqplib.Connection> {
    try {
      const connection = await amqplib.connect(this.#options.url, this.#options.socketOptions)
      connection.on('error', this.onError)
      connection.on('close', this.onClose)
      this.#currentConnection = connection
      this.emit('connect', connection)
      return connection
    } catch (error) {
      this.emit('disconnect', error)
      this.#currentConnection = null
      await sleep(this.#options.reconnectionDelay ?? DEFAULT_RECONNECTION_DELAY)
      return this.connect()
    }
  }

  private onError = (error: any) => {
    //If here connection already clsosed
  }

  private onClose = (err?: any) => {
    this.#currentConnection = null
    this.emit('disconnect', err)
    return sleep(this.#options.reconnectionDelay ?? DEFAULT_RECONNECTION_DELAY)
      .then(() => this.connect())
      .catch(neverThrows)
  }

  get connection() {
    return this.#currentConnection
  }
}
