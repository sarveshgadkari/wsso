// Signed requests from Omni Force Vector:
// X-OmniForce-Signature = hex(HMAC-SHA256(secret, `${timestamp}.${body}`)), 5-minute window.
import { createHmac, timingSafeEqual } from 'crypto'

export function signatureOk(raw: string, ts: string, sig: string, secret: string, now = Date.now()): boolean {
  if (!secret || !/^\d{9,11}$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return false
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false
  const expected = createHmac('sha256', secret).update(`${ts}.${raw}`).digest()
  return timingSafeEqual(Buffer.from(sig, 'hex'), expected)
}
