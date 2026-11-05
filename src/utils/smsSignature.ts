export const SMS_SIGNATURE = 'Yalınayak Süs Tavukları 🐔';

export function withSmsSignature(message: string) {
  let body = message.trimEnd();
  while (body.endsWith(SMS_SIGNATURE)) {
    body = body.slice(0, -SMS_SIGNATURE.length).trimEnd();
  }
  return body ? `${body}\n${SMS_SIGNATURE}` : SMS_SIGNATURE;
}
