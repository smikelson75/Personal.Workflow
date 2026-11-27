// Model tokens for text handed to the model: characters divided by 4, rounded up.
export function tokensOf(chars) {
  return Math.ceil(chars / 4);
}
