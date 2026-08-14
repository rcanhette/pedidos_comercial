export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, factor, index) => acc + Number(base[index]) * factor, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const digit1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${digit1}${digit2}`);
}
