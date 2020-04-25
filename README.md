# Amqp-Connection-Manager

[![Build Status](https://travis-ci.com/lerollq/amqp-connection-manager.svg?branch=master)](https://travis-ci.com/lerollq/amqp-connection-manager) ![Coveralls github](https://img.shields.io/coveralls/github/lerollq/amqplib-connection-manager)

    npm install @lasmala/amqp-connection-manager

A small client library built on top of [amqplib](https://www.npmjs.com/package/amqplib)

## Features

- Attempting to reconnect automatically after connection is closed or disconnected

- Possibility to configure: - Maximum number of attempts - Delay between each attempt
- Possibility to provide a fallback function, called once the limit of attempts is reached
  _**Can be useful to trigger a notification on your side**_

## Basic Example

```typescript
import AmqpConnectionManager from '@lasmala/amqp-connection-manager'

// By default attempt connection on `amqp://localhost` as hostname and `5672` as port
const connection = new AmqpConnectionManager()

const channel = connection.createChannel({
  setup: (channel: amqplib.Channel) => {
    return channel.assertQueue('queue', { autoDelete: true, durable: false })
  },
})
```

## Advanced Example

```typescript
import AmqpConnectionManager from "@lasmala/amqp-connection-manager"

const connection = new AmqpConnectionManager({
    // url can either be a string or an object
    url: {
        hostname: "localhost",
        port: 5671,
        protocol: "amqp",
        password: "your-password",
        username: "your-username"
    },
    reconnectionOptions: {
        delay: 1000 // Default value 5000,
        maximumAttempts: 100 // Default -1, meaning unlimited attempt
        fallback: () => {
            // This method will be triggered once the 100 maximumAttempts is reached
        }
    }
})
const channel = connection.createChannel({
    setup: (channel:amqplib.Channel) => Promise.all([
            channel.assertExchange('exchange', 'fanout', { durable: false, autoDelete: true }),
            channel.assertQueue('', { autoDelete: true, durable: false }).then(({ queue }) => {
                return channel.bindQueue(queue, 'exchange', '').then(() =>
                    channel.consume(queue, (msg) => console.log("Incomming message", msg?.content.toString())))
        }),
    ])
})

channel.publish('exchange', '', Buffer.from('Send new message'))

```

### Publish Message To Exchange / Send Message To Queue

_Trying to publish/send a message while the channel is not yet created, or the connection closed/pending will result in a lose of the message_

```typescript
....
    channel.publish("exchange", "routing-key", Buffer.from("message content"))
    .then(() => {
        // Message published
    })
    .catch((err)=>{
        // Handle error
    })

    channel.sendToQueue('queue_name', Buffer.from("message content"))
    .then(() => {
        // Message sent to the queue
    })
    .catch((err)=>{
        // Handle error
    })
....
```

### Events

- Connection Events

```typescript
....
    connection.on('connect', () => {
      // Emitted once the connection is established
    })
    connection.on('reconnect', (attempt:number) => {
      // Emitted during a connection attempt
    })
    connection.on('error', (err:any) => {...})
    connection.on('close', (err?:any) => {...})
....
```

- Channel Events

```typescript
....
    channel.on('error', (err:any) => {...})
    channel.on('create', (err?:any) => {
        // Emitted as soon the channel has been successfully created
    })
....
```

Inspired by: [node-amqp-connection-manager](https://github.com/benbria/node-amqp-connection-manager.git)
