jest.mock('../src/helpers', () => ({
  sleep: jest.fn().mockImplementation((delay: number) => Promise.resolve()),
  neverThrows: jest.fn(),
}))
import { AmqpConnectionManager } from '../src/connectionManager'
import amqplib from 'amqplib'
import { createMockedConnection } from './mocks'
import * as helpers from '../src/helpers'
import { AmqpChannelWrapper } from '../src/channelWrapper'

describe('Connection Manager', () => {
  let connectionManager: AmqpConnectionManager
  const mockedConnection = createMockedConnection()
  beforeEach(() => {
    jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation(() => {})
    connectionManager = new AmqpConnectionManager({ url: 'fake-url' })
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  describe('Contructor', () => {
    it('Should init without crashing', () => {
      jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation(() => {})
      const result = new AmqpConnectionManager({ url: 'amqp://localhost' })
      expect(result instanceof AmqpConnectionManager)
      expect((AmqpConnectionManager.prototype as any).connect).toHaveBeenCalledTimes(1)
    })
  })
  describe('Private Method: connect', () => {
    it('should call amqplib.connect method with connection options passed to the constructor ', async () => {
      jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
      await (connectionManager as any).connect()
      expect(amqplib.connect).toHaveBeenCalledWith('fake-url', undefined)
    })
    it('should bind methods on connection events ', async () => {
      jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
      await (connectionManager as any).connect()
      expect(mockedConnection.on).toHaveBeenCalledTimes(2)
      expect(mockedConnection.on).toHaveBeenNthCalledWith(1, 'error', jasmine.any(Function))
      expect(mockedConnection.on).toHaveBeenNthCalledWith(2, 'close', jasmine.any(Function))
    })
    it('should set returned amqplib connection as currentConnection class property', async () => {
      jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
      expect(connectionManager.connection).toEqual(null)
      await (connectionManager as any).connect()
      expect(connectionManager.connection).toEqual(mockedConnection)
    })
    it('should emit connect event with connection as parameter', async () => {
      const spy = jest.spyOn(connectionManager, 'emit')
      jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
      await (connectionManager as any).connect()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('connect', mockedConnection)
    })
    it('should emit disconnect if failure has been threw', async () => {
      const spy = jest.spyOn(connectionManager, 'emit')
      jest
        .spyOn(amqplib, 'connect')
        .mockRejectedValueOnce(new Error('Connection Error'))
        .mockResolvedValueOnce(mockedConnection)
      await (connectionManager as any).connect()
      expect(spy).toHaveBeenNthCalledWith(1, 'disconnect', new Error('Connection Error'))
    })
    it('should sleep for 5000 ms (default delay) in case of failure before calling connect method again', async () => {
      jest
        .spyOn(amqplib, 'connect')
        .mockRejectedValueOnce(new Error('Connection Error'))
        .mockResolvedValueOnce(mockedConnection)
      await (connectionManager as any).connect()
      expect(helpers.sleep).toHaveBeenCalledWith(5000)
    })
    it('should sleep for 1000 ms (delay passed as option in constructor) in case of failure before calling connect method again', async () => {
      jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation(() => {})
      const connectionManager = new AmqpConnectionManager({ url: '', reconnectionDelay: 1000 })
      jest.restoreAllMocks()
      jest
        .spyOn(amqplib, 'connect')
        .mockRejectedValueOnce(new Error('Connection Error'))
        .mockResolvedValueOnce(mockedConnection)
      await (connectionManager as any).connect()
      expect(helpers.sleep).toHaveBeenCalledWith(1000)
    })
  })
  describe('Private Method: createChannel', () => {
    it('should instantiate and return AmqpChannelWrapper', () => {
      const channel = connectionManager.createChannel({})
      expect(channel instanceof AmqpChannelWrapper).toEqual(true)
    })
    it('should bind method to channel close event', () => {
      const spy = jest.spyOn(AmqpChannelWrapper.prototype, 'once')
      connectionManager.createChannel({})
      expect(spy).toHaveBeenCalledWith('close', jasmine.any(Function))
    })
    it('should push new channelWrapper to list', () => {
      expect(connectionManager.channels.length).toEqual(0)
      connectionManager.createChannel({})
      expect(connectionManager.channels.length).toEqual(1)
    })
  })
  describe('Private Method: removeChannel', () => {
    it('should remove channel from list', () => {
      const channel = connectionManager.createChannel({})
      expect(connectionManager.channels.length).toEqual(1)
      ;(connectionManager as any).removeChannel(channel)
      expect(connectionManager.channels.length).toEqual(0)
    })
    it('should be triggered if channelWrapper emit close event', () => {
      const spy = jest.spyOn(connectionManager as any, 'removeChannel')
      const channel = connectionManager.createChannel({})
      channel.emit('close')
      expect(spy).toHaveBeenCalledWith(channel)
    })
  })
  describe('Private Method: onClose', () => {
    it('should reset currentConnection', async () => {
      jest.spyOn(helpers, 'sleep').mockImplementation(() => Promise.reject())
      jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
      await (connectionManager as any).connect()
      expect(connectionManager.connection).toEqual(mockedConnection)
      await (connectionManager as any).onClose('ERRCONRESET')
      expect(connectionManager.connection).toEqual(null)
    })
    it('should emit disconnect event', async () => {
      const spy = jest.spyOn(connectionManager, 'emit')
      await (connectionManager as any).onClose('ERRCONRESET')
      expect(spy).toHaveBeenCalledWith('disconnect', 'ERRCONRESET')
    })
    it('should attempt a reconnection', async () => {
      jest.spyOn(helpers, 'sleep').mockImplementation(() => Promise.resolve())
      jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
      const spy = jest.spyOn(AmqpConnectionManager.prototype as any, 'connect')
      expect(spy).toHaveBeenCalledTimes(0)
      await (connectionManager as any).onClose('ERRCONRESET')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('should sleep for 5000 ms (default delay) before calling connect method again', async () => {
      jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
      await (connectionManager as any).onClose('ERRCONRESET')
      expect(helpers.sleep).toHaveBeenCalledWith(5000)
    })
    it('should sleep for 1000 ms (delay passed as option in constructor) before calling connect method again', async () => {
      jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation(() => {})
      const connectionManager = new AmqpConnectionManager({ url: '', reconnectionDelay: 1000 })
      jest.restoreAllMocks()
      jest.spyOn(amqplib, 'connect').mockResolvedValueOnce(mockedConnection)
      await (connectionManager as any).onClose('ERRCONRESET')
      expect(helpers.sleep).toHaveBeenCalledWith(1000)
    })
  })
})
