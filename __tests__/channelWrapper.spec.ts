import { createMockedConnection, createMockedChannel } from './mocks'
import AmqpConnectionManager from '../src'
import { AmqpChannelWrapper } from '../src/channelWrapper'
import waitForExpect from 'wait-for-expect'
import amqplib from 'amqplib'

describe('Channel Wrapper', () => {
  const setupFunc = jest.fn()
  const mockedChannel = createMockedChannel()
  const mockedConnection = createMockedConnection()
  jest.spyOn(AmqpConnectionManager.prototype as any, 'connect').mockImplementation()
  const connectionManager = new AmqpConnectionManager({})
  connectionManager.currentConnection = mockedConnection

  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    jest.spyOn(AmqpChannelWrapper.prototype, 'emit').mockImplementation()
  })

  afterEach(() => {
    connectionManager.removeAllListeners()
  })

  it('should initialize without crashing', () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    let channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    expect(channelWrapper.setup).toEqual([setupFunc])
    expect(channelWrapper.currentChannel).toBeNull()
    channelWrapper = new AmqpChannelWrapper(connectionManager, {})
    expect(channelWrapper.setup).toEqual([])
  })

  it('should trigger createChannel method when connection already ready at initialization', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(true)
    jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
    new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    expect((AmqpChannelWrapper.prototype as any).createChannel).toHaveBeenCalled()
  })

  it('should trigger createChannel method when connection emit connect event', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
    new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    expect((AmqpChannelWrapper.prototype as any).createChannel).not.toHaveBeenCalled()
    connectionManager.emit('connect', mockedConnection)
    expect((AmqpChannelWrapper.prototype as any).createChannel).toHaveBeenCalled()
  })

  it('should trigger onConnectionClose method when connection emit close event', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnectionClose')
    new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    expect((AmqpChannelWrapper.prototype as any).onConnectionClose).not.toHaveBeenCalled()
    connectionManager.emit('close')
    expect((AmqpChannelWrapper.prototype as any).onConnectionClose).toHaveBeenCalled()
  })

  it('should create channel, resolve setup function and emit create event', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
    setupFunc.mockImplementation((channel: any) => Promise.resolve())
    const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    const spyEmit = jest.spyOn(channelWrapper, 'emit')
    connectionManager.emit('connect', mockedConnection)
    await waitForExpect(() => {
      expect(spyEmit).toHaveBeenCalledWith('create')
    })
    expect(spyEmit).toHaveBeenCalledWith('create')
    expect(channelWrapper.currentChannel).toEqual(mockedChannel)
  })

  it('should reset currentChannel and emit error event in case of failure', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
    setupFunc.mockImplementation((channel: any) => Promise.reject(new Error('Setup Function Error')))
    const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    connectionManager.emit('connect', mockedConnection)
    await waitForExpect(() => {
      expect(AmqpChannelWrapper.prototype.emit).toHaveBeenCalledWith('error', new Error('Setup Function Error'))
    })
    expect(channelWrapper.currentChannel).toEqual(null)
  })

  describe('publish method should', () => {
    const createSpyPublish = (error?: any) =>
      jest
        .spyOn(mockedChannel, 'publish')
        .mockImplementation(
          (
            exchange: string,
            routingKey: string,
            content: Buffer,
            options?: amqplib.Options.Publish | undefined,
            callback?: (err: any, ok: amqplib.Replies.Empty) => void
          ) => {
            callback && callback(error, {})
            return true
          }
        )

    it('be resolved', async () => {
      createSpyPublish()
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      const result = await channelWrapper.publish('exchange', '', Buffer.from('content'))
      expect(mockedChannel.publish).toHaveBeenCalledWith(
        'exchange',
        '',
        Buffer.from('content'),
        undefined,
        jasmine.any(Function)
      )
    })
    it('be rejected if channel.publish return error', async () => {
      createSpyPublish(new Error('Publish error'))
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      await expect(channelWrapper.publish('exchange', '', Buffer.from('content'))).rejects.toThrowError(
        new Error('Publish error')
      )
    })
    it('be rejected if currentChannel is null', async () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(null)
      await expect(channelWrapper.publish('exchange', '', Buffer.from('content'))).rejects.toThrowError(
        new Error('Current channel is null')
      )
    })
  })

  describe('sendToQueue method should', () => {
    const createSpySendToQueue = (error?: any) =>
      jest
        .spyOn(mockedChannel, 'sendToQueue')
        .mockImplementation(
          (
            queue: string,
            content: Buffer,
            options?: amqplib.Options.Publish | undefined,
            callback?: (err: any, ok: amqplib.Replies.Empty) => void
          ) => {
            callback && callback(error, {})
            return true
          }
        )

    it('be resolved', async () => {
      createSpySendToQueue()
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      const result = await channelWrapper.sendToQueue('queue', Buffer.from('content'))
      expect(mockedChannel.sendToQueue).toHaveBeenCalledWith(
        'queue',
        Buffer.from('content'),
        undefined,
        jasmine.any(Function)
      )
    })
    it('be rejected if channel.publish return error', async () => {
      createSpySendToQueue(new Error('SendToQueue error'))
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      await expect(channelWrapper.sendToQueue('queue', Buffer.from('content'))).rejects.toThrowError(
        new Error('SendToQueue error')
      )
    })
    it('be rejected if currentChannel is null', async () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(null)
      await expect(channelWrapper.sendToQueue('queue', Buffer.from('content'))).rejects.toThrowError(
        new Error('Current channel is null')
      )
    })
  })

  describe('ack method should', () => {
    const spy = jest.spyOn(mockedChannel, 'ack')

    it('be executed', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      channelWrapper.ack({ content: {}, fields: {}, properties: {} } as amqplib.Message, true)
      expect(spy).toHaveBeenCalledWith({ content: {}, fields: {}, properties: {} }, true)
    })
    it('not be executed if currentChannel is null', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(null)
      channelWrapper.ack({ content: {}, fields: {}, properties: {} } as amqplib.Message, true)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('ackAll method should', () => {
    const spy = jest.spyOn(mockedChannel, 'ackAll')

    it('be executed', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      channelWrapper.ackAll()
      expect(spy).toHaveBeenCalled()
    })
    it('not be executed if currentChannel is null', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(null)
      channelWrapper.ackAll()
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('nack method should', () => {
    const spy = jest.spyOn(mockedChannel, 'nack')

    it('be executed', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      channelWrapper.nack({ content: {}, fields: {}, properties: {} } as amqplib.Message, true, true)
      expect(spy).toHaveBeenCalled()
    })
    it('not be executed if currentChannel is null', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(null)
      channelWrapper.nack({ content: {}, fields: {}, properties: {} } as amqplib.Message, true, true)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('nackAll method should', () => {
    const spy = jest.spyOn(mockedChannel, 'nackAll')

    it('be executed', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(mockedChannel)
      channelWrapper.nackAll()
      expect(spy).toHaveBeenCalled()
    })
    it('not be executed if currentChannel is null', () => {
      jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
      const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
      jest.spyOn(channelWrapper, 'currentChannel', 'get').mockReturnValue(null)
      channelWrapper.nackAll()
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
