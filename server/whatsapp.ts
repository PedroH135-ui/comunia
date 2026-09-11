import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const graphVersion = () => process.env.WHATSAPP_API_VERSION || 'v23.0';

export function whatsappConfigured() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.WHATSAPP_APP_SECRET,
  );
}

export function verifyWhatsAppSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const received = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

const webhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z
    .array(
      z.object({
        changes: z.array(
          z.object({
            value: z.object({
              messages: z
                .array(
                  z.object({
                    id: z.string().min(1).max(300),
                    from: z.string().regex(/^\d{6,20}$/),
                    type: z.string(),
                    text: z.object({ body: z.string().trim().min(1).max(1000) }).optional(),
                  }),
                )
                .optional(),
            }),
          }),
        ),
      }),
    )
    .max(100),
});

export function extractWhatsAppTextMessages(payload: unknown) {
  const parsed = webhookSchema.parse(payload);
  return parsed.entry.flatMap((entry) =>
    entry.changes.flatMap((change) =>
      (change.value.messages || [])
        .filter((message) => message.type === 'text' && message.text)
        .map((message) => ({ id: message.id, from: message.from, text: message.text!.body })),
    ),
  );
}

export async function sendWhatsAppText(to: string, body: string) {
  if (!whatsappConfigured()) throw new Error('WhatsApp não configurado.');
  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(graphVersion())}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID!)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`Falha ao enviar resposta do WhatsApp (${response.status}).`);
}
