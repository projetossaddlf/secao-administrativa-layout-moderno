// utils/matricula.ts
export const normalizeMatriculaDigits = (value: string): string => {
  // remove espaços invisíveis e tudo que não for dígito
  return (value ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\D/g, '');
};
