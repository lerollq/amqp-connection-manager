# Amqp-Connection-Manager

[![Build Status](https://travis-ci.com/lerollq/amqplib-connection-manager.svg?branch=master)](https://travis-ci.com/lerollq/amqplib-connection-manager) ![Coveralls github](https://img.shields.io/coveralls/github/lerollq/amqplib-connection-manager)

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
```

Inspired by: https://github.com/benbria/node-amqp-connection-manager.git
