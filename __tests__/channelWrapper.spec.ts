import { createMockedConnection, createMockedChannel } from './mocks'
import AmqpConnectionManager from '../src'
import { AmqpChannelWrapper } from '../src/channelWrapper'
import { sleep } from '../src/helpers'

describe('Channel Wrapper', () => {
  const setupFunc = jest.fn()
  const mockedChannel = createMockedChannel()
  const mockedConnection = createMockedConnection()
  const connectionManager = new AmqpConnectionManager({})
  connectionManager.currentConnection = mockedConnection

  beforeEach(() => {
    jest.restoreAllMocks()
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
    const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    expect((AmqpChannelWrapper.prototype as any).createChannel).toHaveBeenCalled()
  })

  it('should trigger createChannel method when connection emit connect event', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(AmqpChannelWrapper.prototype as any, 'createChannel').mockImplementation()
    const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    expect((AmqpChannelWrapper.prototype as any).createChannel).not.toHaveBeenCalled()
    connectionManager.emit('connect', mockedConnection)
    expect((AmqpChannelWrapper.prototype as any).createChannel).toHaveBeenCalled()
  })

  it('should trigger onConnectionClose method when connection emit close event', async () => {
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(AmqpChannelWrapper.prototype as any, 'onConnectionClose')
    const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
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
    await sleep(50)
    expect(spyEmit).toHaveBeenCalledWith('create')
    expect(channelWrapper.currentChannel).toEqual(mockedChannel)
  })

  it('should reset currentChannel and emit error event in case of failure', async () => {
    const spyEmit = jest.spyOn(AmqpChannelWrapper.prototype, 'emit').mockImplementation()
    jest.spyOn(connectionManager, 'isConnected').mockReturnValue(false)
    jest.spyOn(mockedConnection, 'createConfirmChannel').mockResolvedValue(mockedChannel)
    setupFunc.mockImplementation((channel: any) => Promise.reject(new Error('Setup Function Error')))
    const channelWrapper = new AmqpChannelWrapper(connectionManager, { setup: setupFunc })
    connectionManager.emit('connect', mockedConnection)
    await sleep(50)
    expect(spyEmit).toHaveBeenCalledWith('error', new Error('Setup Function Error'))
    expect(channelWrapper.currentChannel).toEqual(null)
  })
})
