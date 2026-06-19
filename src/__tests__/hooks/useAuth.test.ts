import { renderHook } from '@testing-library/react'
import { useAuth } from '@/hooks'

describe('useAuth', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should initialize with null user', () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
  })

  it('should have logout function', () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const { result } = renderHook(() => useAuth())
    expect(typeof result.current.logout).toBe('function')
  })
})
