import amqplib from 'amqplib'
import { createMockedConnection, createMockedChannel } from './mocks'
import AmqpConnectionManager from '../src'
import { AmqpChannelWrapper } from '../src/channelWrapper'

describe('AmqpChannelWrapper', () => {
  let channelWrapper: AmqpChannelWrapper
  let connectionManager: AmqpConnectionManager
  const mockedConnection = createMockedConnection()
  const mockedChannel = createMockedChannel()
  const setupFunc = jest.fn().mockImplementation((channel: any) => {
    return Promise.resolve(channel)
  })

  beforeEach(() => {
    jest.spyOn(amqplib, 'connect').mockResolvedValue(mockedConnection)
    connectionManager = new AmqpConnectionManager({ url: 'fake-url' })
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should init without crashing', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnect').mockImplementation()
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      expect(channelWrapper instanceof AmqpChannelWrapper).toEqual(true)
    })

    it('should call onConnect method', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnect').mockImplementation()
      const spy = jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnect')
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('should not call onConnect method if connectionManager.isConnected return false', () => {
      const spy = jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnect').mockImplementation()
      jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      expect(spy).not.toHaveBeenCalled()
    })

    it('should bind method to connectionManager events', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnect').mockImplementation()
      const spy = jest.spyOn(connectionManager, 'on')
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenNthCalledWith(1, 'connect', jasmine.any(Function))
      expect(spy).toHaveBeenNthCalledWith(2, 'disconnect', jasmine.any(Function))
    })
  })
  describe('Private Method: onConnect', () => {
    const mockedConnection = createMockedConnection()
    beforeEach(() => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnect').mockImplementation()
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.restoreAllMocks()
      jest.resetAllMocks()
    })

    it('should call connection.createConfirmChannel method', async () => {
      const spy = jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('should bind method to close channel event', async () => {
      const spy = jest.spyOn(mockedChannel, 'on')
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(spy).toHaveBeenCalledWith('close', jasmine.any(Function))
    })
    it('should set created channel as currentChannel', async () => {
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      expect(channelWrapper.currentChannel).toEqual(null)
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(channelWrapper.currentChannel).toEqual(mockedChannel)
    })
    it('should resolve setup functions', async () => {
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(setupFunc).toHaveBeenCalledWith(mockedChannel)
    })
    it('should emit error in case of failure while resolving setup functions', async () => {
      const spy = jest.spyOn(channelWrapper, 'emit')
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      setupFunc.mockRejectedValue(new Error('Resolve Error'))
      await (channelWrapper as any).onConnect(mockedConnection).catch(() => {
        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith('error', new Error('Resolve Error'))
      })
    })
    it('should emit error in case when an error has been threw', async () => {
      const spy = jest.spyOn(channelWrapper, 'emit')
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockRejectedValue(new Error('Error channel'))
      await (channelWrapper as any).onConnect(mockedConnection).catch(() => {
        expect(spy).toHaveBeenCalledWith('error', new Error('Error channel'))
      })
    })
    it('should bind method to channel close event', async () => {
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      const spy = jest.spyOn(mockedChannel, 'on')
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(spy).toHaveBeenCalledWith('close', jasmine.any(Function))
    })
    it('should set channel as currentChannel', async () => {
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      expect(channelWrapper.currentChannel).toEqual(null)
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(channelWrapper.currentChannel).toEqual(mockedChannel)
    })
  })
  describe('Private Method: onDisconnect', () => {
    it('should reset currentChannel', async () => {
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(channelWrapper.currentChannel).not.toBeNull()
      ;(channelWrapper as any).onDisconnect()
      expect(channelWrapper.currentChannel).toBeNull()
    })
  })
  describe('Private Method: onChannelClose', () => {
    it('should reset currentChannel', async () => {
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(channelWrapper.currentChannel).not.toBeNull()
      ;(channelWrapper as any).onChannelClose(mockedChannel)
      expect(channelWrapper.currentChannel).toBeNull()
    })
    it('should not reset currentChannel', async () => {
      const wrongChannel = createMockedChannel()
      jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
      channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      await (channelWrapper as any).onConnect(mockedConnection)
      expect(channelWrapper.currentChannel).not.toBeNull()
      ;(channelWrapper as any).onChannelClose(wrongChannel)
      expect(channelWrapper.currentChannel).not.toBeNull()
    })
  })
})
