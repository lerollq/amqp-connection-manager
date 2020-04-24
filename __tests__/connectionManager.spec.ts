jest.mock('../src/helpers', () => ({
  sleep: jest.fn().mockImplementation((delay: number) => Promise.resolve()),
}))
import { AmqpConnectionManager } from '../src/connectionManager'
import amqplib from 'amqplib'
import { createMockedConnection } from './mocks'

jest.useFakeTimers()

describe('Connection Manager', () => {
  const connectionOptions = {
    url: 'amqp://random-host',
    reconnectionOptions: { maximumAttempts: 5 },
    socketOptions: {},
  }
  const mockedConnection = createMockedConnection()

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('should initialize with passed options', () => {
    const fallback = () => true
    const connectionManager = new AmqpConnectionManager({
      url: {
        frameMax: 15,
        port: 3000,
        protocol: 'amqp',
      },
      reconnectionOptions: { delay: 1000, fallback },
      socketOptions: { key: 'value' },
    })
    expect(connectionManager.options).toEqual({
      url: {
        frameMax: 15,
        port: 3000,
        protocol: 'amqp',
      },
      reconnectionOptions: { delay: 1000, maximumAttempts: -1, fallback },
      socketOptions: { key: 'value' },
    })
  })

  it('should initialize with default parameters', () => {
    const connectionManager = new AmqpConnectionManager({})
    expect(connectionManager.options).toEqual({
      url: 'amqp://localhost',
      reconnectionOptions: {
        delay: 5000,
        maximumAttempts: -1,
        fallback: jasmine.any(Function),
      },
      socketOptions: {},
    })
  })

  it('should call reconnect private method in case of failure while connection', async () => {
    jest.spyOn(AmqpConnectionManager.prototype, 'emit').mockImplementation()
    jest.spyOn(amqplib, 'connect').mockRejectedValueOnce(new Error('Connection failed'))
    jest.spyOn(AmqpConnectionManager.prototype as any, 'reconnect').mockImplementation()
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    await connectionManager.connect()
    expect((AmqpConnectionManager.prototype as any).reconnect).toHaveBeenCalled()
    expect((AmqpConnectionManager.prototype as any).emit).toHaveBeenCalledWith('error', new Error('Connection failed'))
  })

  it('should add event listeners to connection and emit connect event', async () => {
    jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
    jest.spyOn(mockedConnection, 'on')
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    await connectionManager.connect()
    expect(mockedConnection.on).toHaveBeenCalledTimes(4)
    expect(mockedConnection.on).toHaveBeenCalledWith('error', (connectionManager as any).onConnectionError)
    expect(mockedConnection.on).toHaveBeenCalledWith('close', (connectionManager as any).onConnectionClose)
    expect(mockedConnection.on).toHaveBeenCalledWith('blocked', (connectionManager as any).onConnectionBlocked)
    expect(mockedConnection.on).toHaveBeenCalledWith('unblocked', (connectionManager as any).onConnectionUnblocked)
  })

  it('should create and return channel wrapper', () => {
    jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    const result = connectionManager.createChannel({ setup: (channel) => Promise.resolve() })
    expect(connectionManager.channels.length).toEqual(1)
    expect(connectionManager.channels[0]).toEqual(result)
  })

  it('should remove channel if channel emit close event', () => {
    jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    const channel = connectionManager.createChannel({ setup: (channel) => Promise.resolve() })
    channel.emit('close')
    expect(connectionManager.channels.length).toEqual(0)
  })

  it('should attempt 5 reconnection, then call fallback function', async () => {
    jest.spyOn(AmqpConnectionManager.prototype, 'emit').mockImplementation()
    jest.spyOn(amqplib, 'connect').mockRejectedValue(new Error('Connection failed'))
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    jest.spyOn(connectionManager, 'connect')
    const spyFallback = jest.spyOn(connectionManager.options.reconnectionOptions, 'fallback')
    await connectionManager.connect()
    expect(connectionManager.connect).toHaveBeenCalledTimes(6)
    expect(spyFallback).toBeCalled()
  })

  it('should emit close event and try to reconnect', async () => {
    jest.spyOn(AmqpConnectionManager.prototype as any, 'reconnect').mockImplementation()
    jest.spyOn(AmqpConnectionManager.prototype, 'emit')
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    await (connectionManager as any).onConnectionClose(new Error('On Close'))
    expect(connectionManager.emit).toHaveBeenCalledWith('close', new Error('On Close'))
  })

  it('should emit error event', async () => {
    jest.spyOn(AmqpConnectionManager.prototype, 'emit').mockImplementation()
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    await (connectionManager as any).onConnectionError(new Error('On Error'))
    expect(connectionManager.emit).toHaveBeenCalledWith('error', new Error('On Error'))
  })

  it('should emit blocked event', async () => {
    jest.spyOn(AmqpConnectionManager.prototype, 'emit').mockImplementation()
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    await (connectionManager as any).onConnectionBlocked(new Error('On Blocked'))
    expect(connectionManager.emit).toHaveBeenCalledWith('blocked', new Error('On Blocked'))
  })

  it('should emit unblocked event', async () => {
    jest.spyOn(AmqpConnectionManager.prototype, 'emit').mockImplementation()
    const connectionManager = new AmqpConnectionManager(connectionOptions)
    await (connectionManager as any).onConnectionUnblocked()
    expect(connectionManager.emit).toHaveBeenCalledWith('unblocked')
  })
})
