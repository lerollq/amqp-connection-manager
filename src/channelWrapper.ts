import { AmqpConnectionManager } from './connectionManager'
import { EventEmitter } from 'events'
import amqplib from 'amqplib'

export type SetupFunc = (channel: amqplib.Channel) => Promise<any>

export interface AmqpChannelWrapperOptions {
  setup?: SetupFunc
}

export class AmqpChannelWrapper extends EventEmitter {
  currentChannel: amqplib.ConfirmChannel | null
  setup: SetupFunc[]

  constructor(private connectionManager: AmqpConnectionManager, private options: AmqpChannelWrapperOptions) {
    super()
    this.currentChannel = null
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
          this.currentChannel = channel
          this.emit('create')
        })
      })
      .catch((err) => {
        this.currentChannel = null
        this.emit('error', err)
      })
  }

  // private publish(exchange: string, routingKey: string, content: Buffer, options?: amqplib.Options.Publish): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     if (this.currentChannel) {
  //       this.currentChannel.publish(exchange, routingKey, content, options, (err: any) => {
  //         if (err) return reject(err)
  //         return resolve()
  //       })
  //     }
  //     return reject('Cannot publish, if not channel set up')
  //   })
  // }

  private onConnectionClose() {
    this.currentChannel = null
  }

  // private onDisconnect() {
  //   this.currentChannel = null
  // }

  // private onError(err: any) {}
}
