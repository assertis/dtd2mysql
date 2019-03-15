export function dump(...vars) {
  console.log(...vars);
}

export function dd(...vars) {
  dump(...vars);
  process.exit(1);
}
