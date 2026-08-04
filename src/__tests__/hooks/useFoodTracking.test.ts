import { renderHook, act } from '@testing-library/react'
import { useFoodTracking } from '@/hooks/client/useFoodTracking'
import { compressImageToJpeg } from '@/lib/image-compression'
import { getCsrfToken } from '@/lib/csrf-client'

jest.mock('@/lib/image-compression', () => ({
  compressImageToJpeg: jest.fn(),
}))

jest.mock('@/lib/csrf-client', () => ({
  getCsrfToken: jest.fn(),
}))

const mockedCompressImageToJpeg = compressImageToJpeg as jest.MockedFunction<typeof compressImageToJpeg>
const mockedGetCsrfToken = getCsrfToken as jest.MockedFunction<typeof getCsrfToken>

describe('useFoodTracking', () => {
  beforeEach(() => {
    mockedCompressImageToJpeg.mockImplementation(async (file) => file)
    mockedGetCsrfToken.mockResolvedValue('csrf-test-token')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total_calories: 0, notes: '', photo_url: '' }),
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFoodTracking())

    expect(result.current.analyzing).toBe(false)
    expect(result.current.aiResult).toBeNull()
    expect(result.current.foodError).toBe('')
    expect(result.current.mealSaved).toBe('idle')
    expect(result.current.myMeals).toEqual([])
    expect(result.current.todayCalories).toBe(0)
  })

  it('should have analyzeFood function', () => {
    const { result } = renderHook(() => useFoodTracking())
    expect(typeof result.current.analyzeFood).toBe('function')
  })

  it('compresses meal photos to a 2048px long edge', async () => {
    const { result } = renderHook(() => useFoodTracking())
    const file = new File(['meal'], 'meal.jpg', { type: 'image/jpeg' })

    await act(async () => {
      await result.current.analyzeFood(file)
    })

    expect(mockedCompressImageToJpeg).toHaveBeenCalledWith(file, 2048, 0.9)
  })

  it('should have logMeal function', () => {
    const { result } = renderHook(() => useFoodTracking())
    expect(typeof result.current.logMeal).toBe('function')
  })

  it('should have resetAiResult function', () => {
    const { result } = renderHook(() => useFoodTracking())
    expect(typeof result.current.resetAiResult).toBe('function')
  })
})
