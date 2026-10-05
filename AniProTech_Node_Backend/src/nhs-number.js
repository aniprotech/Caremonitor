export function normaliseNhsNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(text)) return null;
  const weighted = [...text.slice(0, 9)].reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0);
  const remainder = 11 - (weighted % 11);
  const checkDigit = remainder === 11 ? 0 : remainder;
  return checkDigit !== 10 && checkDigit === Number(text[9]) ? text : null;
}
