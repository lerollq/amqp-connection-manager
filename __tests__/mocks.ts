import { Connection, ConfirmChannel } from 'amqplib'

export const createMockedConnection = (): Connection => {
  const conn: any = {}
  conn.on = jest.fn()
  conn.createChannel = jest.fn()
  conn.createConfirmChannel = jest.fn()
  return conn
}

export const createMockedChannel = (): ConfirmChannel => {
  const chann: any = {}
  chann.on = jest.fn()
  chann.publish = jest.fn()
  chann.sendToQueue = jest.fn()
  chann.assertExchange = jest.fn()
  chann.assertQueue = jest.fn()
  chann.bindQueue = jest.fn()
  chann.consume = jest.fn()
  chann.ack = jest.fn()
  chann.ackAll = jest.fn()
  chann.nack = jest.fn()
  chann.nackAll = jest.fn()
  chann.checkExchange = jest.fn()
  chann.checkQueue = jest.fn()
  return chann
}
