// Input validation utilities

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email.length <= 255 && emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 12) {
    return { valid: false, error: "סיסמה חייבת להיות לפחות 12 תווים" };
  }
  if (password.length > 128) {
    return { valid: false, error: "סיסמה ארוכה מדי (מקסימום 128 תווים)" };
  }
  return { valid: true };
}

export function validateName(name: string): boolean {
  return name.length >= 2 && name.length <= 100 && name.trim().length > 0;
}

export function validateWeight(weight: number): boolean {
  return weight > 0 && weight <= 500;
}

export function validateWater(amount: number): boolean {
  return amount > 0 && amount <= 5000;
}

export function validateSteps(steps: number): boolean {
  return steps >= 0 && steps <= 100000;
}

export function sanitizeString(str: string): string {
  return str.trim().slice(0, 10000);
}
