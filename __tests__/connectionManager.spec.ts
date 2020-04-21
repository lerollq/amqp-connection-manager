jest.mock('../src/helpers', () => ({
  sleep: jest.fn().mockImplementation((delay: number) => Promise.resolve()),
}))
import { AmqpConnectionManager } from '../src/connectionManager'
import amqplib from 'amqplib'
import { createMockedConnection } from './mocks'
import * as helpers from '../src/helpers'

describe('Connection Manager', () => {
  describe('Contructor', () => {
    it('Should init without crashing', () => {
      jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation(() => {})
      const result = new AmqpConnectionManager({ url: 'amqp://localhost' })
      expect(result instanceof AmqpConnectionManager)
      expect((AmqpConnectionManager.prototype as any).connect).toHaveBeenCalledTimes(1)
    })
  })
  describe('Private Method: Connect', () => {
    const mockedConnection = createMockedConnection()
    let connectionManager: AmqpConnectionManager
    beforeEach(() => {
      jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation(() => {})
      connectionManager = new AmqpConnectionManager({ url: 'fake-url' })
      jest.restoreAllMocks()
      jest.clearAllMocks()
    })

    it('should call amqplib.connect method with connection options passed to the constructor ', async () => {
      jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
      await (connectionManager as any).connect()
      expect(amqplib.connect).toHaveBeenCalledWith('fake-url', undefined)
    })
    it('should bind methods on connection events ', async () => {
      jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
      await (connectionManager as any).connect()
      expect(mockedConnection.on).toHaveBeenCalledTimes(2)
      expect(mockedConnection.on).toHaveBeenNthCalledWith(1, 'error', (connectionManager as any).onError)
      expect(mockedConnection.on).toHaveBeenNthCalledWith(2, 'close', (connectionManager as any).onClose)
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
})
