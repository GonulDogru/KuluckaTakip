export function normalizeTurkishPhone(input: string) {
  const digits = input.replace(/\D/g, '');
  let national = digits;

  if (national.startsWith('0090')) {
    national = national.slice(4);
  } else if (national.startsWith('90') && national.length === 12) {
    national = national.slice(2);
  }

  if (national.startsWith('0') && national.length === 11) {
    national = national.slice(1);
  }

  if (national.length !== 10 || !national.startsWith('5')) {
    return null;
  }

  return `+90${national}`;
}

export function formatPhoneInput(input: string) {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('0090')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('90')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('5')) {
    digits = `0${digits}`;
  }

  digits = digits.slice(0, 11);

  const first = digits.slice(0, 4);
  const second = digits.slice(4, 7);
  const third = digits.slice(7, 9);
  const fourth = digits.slice(9, 11);

  return [first, second, third, fourth].filter(Boolean).join(' ');
}

export function formatTurkishPhone(normalized: string) {
  const digits = normalized.replace(/\D/g, '').replace(/^90/, '');
  if (digits.length !== 10) {
    return normalized;
  }

  return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}
