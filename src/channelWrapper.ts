import { AmqpConnectionManager } from './connectionManager'
import { EventEmitter } from 'events'
import amqplib from 'amqplib'

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

  /**
   * Publish a single message to an exchange. The mandatory parameters are:
   *
   * - exchange and routingKey: the exchange and routing key, which determine where the message goes.
   * A special case is sending '' as the exchange, which will send directly to the queue named by the routing key
   *
   * - content: a buffer containing the message content. This will be copied during encoding, so it is safe to mutate it once this method has returned.
   *
   * @throws Will throw an error if the currentChannel is null. This can happen if you try to publish after a connection closed or not yet set up
   */

  public publish(exchange: string, routingKey: string, content: Buffer, options?: amqplib.Options.Publish): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.currentChannel) {
        this.currentChannel.publish(exchange, routingKey, content, options, (err: any) => {
          if (err) return reject(err)
          return resolve()
        })
      }
      return reject(new Error('Current channel is null'))
    })
  }

  /**
   * Acknowledge the given message, or all messages up to and including the given message.
   *
   * If a #consume or #get is issued with noAck: false (the default), the server will expect acknowledgements for messages before forgetting about them. If no such acknowledgement is given, those messages may be requeued once the channel is closed.
   *
   * If allUpTo is true, all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged.
   *
   * It’s an error to supply a message that either doesn’t require acknowledgement, or has already been acknowledged. Doing so will errorise the channel. If you want to acknowledge all the messages and you don’t have a specific message around, use #ackAll.
   */

  public ack(message: amqplib.Message, allUpTo?: boolean | undefined): void | undefined {
    return this.currentChannel?.ack(message, allUpTo)
  }

  /**
   * Acknowledge all outstanding messages on the channel. This is a “safe” operation, in that it won’t result in an error even if there are no such messages.
   */
  public ackAll(): void | undefined {
    return this.currentChannel?.ackAll()
  }

  /**
   * Reject a message. This instructs the server to either requeue the message or throw it away (which may result in it being dead-lettered).
   *
   * If allUpTo is truthy, all outstanding messages prior to and including the given message are rejected. As with #ack, it’s a channel-ganking error to use a message that is not outstanding. Defaults to false.
   *
   * If requeue is truthy, the server will try to put the message or messages back on the queue or queues from which they came. Defaults to true if not given, so if you want to make sure messages are dead-lettered or discarded, supply false here.
   *
   * This and #nackAll use a RabbitMQ-specific extension.
   * @link http://www.rabbitmq.com/nack.html
   */

  public nack(message: amqplib.Message, allUpTo?: boolean | undefined, requeue?: boolean | undefined): void | undefined {
    return this.currentChannel?.nack(message, allUpTo, requeue)
  }

  /**
   * Reject all messages outstanding on this channel. If requeue is truthy, or omitted, the server will try to re-enqueue the messages.
   */

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
