export function normaliseNhsNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return "";
    const digits = String(value).replace(/[\s-]/g, "");
    if (!/^\d{10}$/.test(digits)) return null;
    const sum = [...digits.slice(0, 9)].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
    const remainder = 11 - (sum % 11);
    const checkDigit = remainder === 11 ? 0 : remainder;
    return checkDigit !== 10 && checkDigit === Number(digits[9]) ? digits : null;
}
