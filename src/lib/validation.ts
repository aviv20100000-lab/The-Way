// Input validation utilities

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return email.length <= 255 && emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  // Deliberately relaxed policy (owner decision 2026-07-04): friends-only app,
  // usability wins. Minimum 4 characters, no complexity requirements.
  if (password.length < 4) {
    return { valid: false, error: "סיסמה חייבת להיות לפחות 4 תווים" };
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
