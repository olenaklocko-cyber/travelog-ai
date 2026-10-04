/**
 * 🈶 Переклад помилок Supabase українською.
 * Користувач ніколи не має бачити голої англійської фрази —
 * це частина відгуку «спочатку не розумію, що відбувається».
 */
export function perekladPomylky(message: string): string {
  const pomylky: Record<string, string> = {
    "Invalid login credentials": "Невірний email або пароль",
    "User already registered": "Користувач вже зареєстрований",
    "Password should be at least 6 characters":
      "Пароль має бути мінімум 6 символів",
    "Email not confirmed": "Email не підтверджено. Перевірте пошту",
    "Unable to validate email address: invalid format":
      "Невірний формат email",
    "Signup requires a valid password": "Введіть пароль",
    "Auth session or user missing": "Сесію не знайдено. Спробуйте ще раз",
    "Failed to fetch": "Немає інтернету. Перевірте з'єднання",
    "Token has expired or is invalid": "Сесія завершилась. Увійдіть ще раз",
  };
  return pomylky[message] || message;
}

