import amqplib from 'amqplib'
import { EventEmitter } from 'events'
import { sleep } from './helpers'
import { AmqpChannelWrapper, AmqpChannelWrapperOptions } from './channelWrapper'

const DEFAULT_CONNECTION_URL = 'amqp://localhost'
const DEFAULT_RECONNECTION_DELAY = 5000
const DEFAULT_MAXIMUM_ATTEMPTS = -1

export interface ReconnectionOptions {
  /**
   * Time in milliseconds before attempting a new connection
   *
   * Default Value: 5000
   * */
  delay: number
  /**
   * The maximum number of connection attempt which will be tried. Once the limit reached, process stop by executing (if provided) the fallback function
   *
   * A negative value for maximumAttempts indicates no such limit.
   *
   * Default Value: -1
   */
  maximumAttempts: number
  /**
   * A function which will be triggered once the maximum of connection attempts reached
   * Will not be triggered if the maxAttempt is on the default value
   */
  fallback(): void
}

export interface ConnectionOptions {
  url: string | amqplib.Options.Connect
  reconnectionOptions: ReconnectionOptions
  socketOptions: object
}

export interface AmqpConnectionManager {
  on(event: 'reconnect', listener: (attempt: number) => void): this
  on(event: 'connect', listener: (connection: amqplib.Connection) => void): this
  on(event: 'close', listener: (err?: any) => void): this
  on(event: 'error', listener: (err: any) => void): this
  on(event: 'blocked', listener: (reason: any) => void): this
  on(event: 'unblocked', listener: (err: any) => void): this
  on(event: string, listener: Function): this
}

type Optional<T> = {
  [K in keyof T]?: Optional<T[K]>
}
export class AmqpConnectionManager extends EventEmitter {
  currentConnection: amqplib.Connection | null
  channels: AmqpChannelWrapper[]

  options: ConnectionOptions

  #reconnectionAttempt: number = 0
  #connectPromise: Promise<void> | null = null
  constructor({
    url = DEFAULT_CONNECTION_URL,
    reconnectionOptions: {
      delay = DEFAULT_RECONNECTION_DELAY,
      fallback = () => {},
      maximumAttempts = DEFAULT_MAXIMUM_ATTEMPTS,
    } = {
      delay: DEFAULT_RECONNECTION_DELAY,
      fallback: () => {},
      maximumAttempts: DEFAULT_MAXIMUM_ATTEMPTS,
    },
    socketOptions = {},
  }: Optional<ConnectionOptions>) {
    super()
    this.currentConnection = null
    this.channels = []

    this.options = {
      socketOptions,
      reconnectionOptions: {
        delay,
        fallback,
        maximumAttempts,
      },
      url,
    } as ConnectionOptions
    this.connect()
  }

  public createChannel(options: AmqpChannelWrapperOptions): AmqpChannelWrapper {
    const channel = new AmqpChannelWrapper(this, options)
    this.channels.push(channel)
    channel.once('close', () => this.removeChannel(channel))
    return channel
  }

  public isConnected() {
    return !!this.currentConnection
  }

  private connect() {
    if (this.#connectPromise) return this.#connectPromise
    return (this.#connectPromise = amqplib
      .connect(this.options.url, this.options.socketOptions)
      .then((connection) => {
        connection.on('error', this.onConnectionError)
        connection.on('close', this.onConnectionClose)
        connection.on('blocked', this.onConnectionBlocked)
        connection.on('unblocked', this.onConnectionUnblocked)
        this.currentConnection = connection
        this.#reconnectionAttempt = 0
        this.#connectPromise = null
        this.emit('connect', connection)
        return this.currentConnection
      })
      .catch((error) => {
        this.emit('error', error)
        this.#connectPromise = null
        return this.reconnect()
      }))
  }

  private reconnect(): Promise<void> | void {
    if (!this.isMaximumAttemptsReached()) {
      this.currentConnection = null
      this.#reconnectionAttempt++
      this.emit('reconnect', this.#reconnectionAttempt)
      return sleep(this.options.reconnectionOptions.delay).then(() => this.connect())
    } else {
      return this.options.reconnectionOptions.fallback()
    }
  }

  private removeChannel(channel: AmqpChannelWrapper) {
    this.channels = this.channels.filter((chann) => chann !== channel)
  }

  /// Connection Events Listenners

  private onConnectionError = (error: any) => {
    this.emit('error', error)
  }

  private onConnectionClose = async (error?: any) => {
    this.emit('close', error)
    await this.reconnect()
  }

  private onConnectionBlocked = (reason: any) => {
    this.emit('blocked', reason)
  }

  private onConnectionUnblocked = () => {
    this.emit('unblocked')
  }

  // Helpers

  private isMaximumAttemptsReached(): boolean {
    const { maximumAttempts } = this.options.reconnectionOptions
    if (maximumAttempts < 0 || this.#reconnectionAttempt < maximumAttempts) return false
    return true
  }
}
