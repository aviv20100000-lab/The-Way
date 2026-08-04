import { normalizeTzameretName } from '@/lib/tzameret'

describe('normalizeTzameretName cooking states', () => {
  it.each([
    ['תפוחי אדמה מבושלים', 'תפוחי אדמה'],
    ['ירקות מבושלות', 'ירקות'],
    ['פלפלים מטוגנים', 'פלפלים'],
    ['קציצות מטוגנות', 'קציצות'],
    ['ירקות צלויים', 'ירקות'],
    ['עגבניות צלויות', 'עגבניות'],
    ['תפוחי אדמה אפויים', 'תפוחי אדמה'],
    ['בטטות אפויות', 'בטטות'],
  ])('removes the plural cooking state from %s', (input, expected) => {
    expect(normalizeTzameretName(input)).toBe(expected)
  })
})
