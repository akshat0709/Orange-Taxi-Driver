// Aadhaar number entry for chauffeur sign-up.
//
// The field keeps the digits the driver types (so typing, deleting and pasting work) and shows
// them grouped as "1234 5678 9012". Only a masked form, "XXXX-XXXX-9012", is ever saved: UIDAI
// rules don't allow storing full Aadhaar numbers, and the admin checks the uploaded card anyway.

/** Digits only, at most 12. */
export function aadhaarDigits(text: string): string {
  return (text || '').replace(/\D/g, '').slice(0, 12);
}

/** "123456789012" -> "1234 5678 9012" (partial input is grouped the same way). */
export function formatAadhaar(digits: string): string {
  return aadhaarDigits(digits).replace(/(\d{4})(?=\d)/g, '$1 ');
}

// Verhoeff checksum, which every Aadhaar number carries in its last digit.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True for a 12-digit number that doesn't start with 0 or 1 and passes the Verhoeff check. */
export function isValidAadhaar(digits: string): boolean {
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][rev[i]]];
  return c === 0;
}

/** What gets saved: "XXXX-XXXX-9012". */
export function maskAadhaar(digits: string): string {
  return `XXXX-XXXX-${aadhaarDigits(digits).slice(-4)}`;
}
