import { renderHook, act, waitFor } from '@testing-library/react'
import { useFoodTracking } from '@/hooks'

describe('useFoodTracking', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
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

  it('should have logMeal function', () => {
    const { result } = renderHook(() => useFoodTracking())
    expect(typeof result.current.logMeal).toBe('function')
  })

  it('should have resetAiResult function', () => {
    const { result } = renderHook(() => useFoodTracking())
    expect(typeof result.current.resetAiResult).toBe('function')
  })
})
