import { z } from 'astro:content';

const section = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('html'), html: z.string() }),
  z.object({ kind: z.literal('videos'), title: z.string(), items: z.array(z.object({ title: z.string(), video_url: z.string(), image_url: z.string(), focus_y: z.number() })) }),
  z.object({ kind: z.literal('prices'), title: z.string(), eyebrow: z.string(), description: z.string() }),
  z.object({ kind: z.literal('faq'), title: z.string(), eyebrow: z.string(), items: z.array(z.object({ question: z.string(), answer: z.string() })) }),
]);
export const approvedTreatmentSchema = z.object({
  version: z.number(), sections: z.array(section),
  assets: z.array(z.object({ token: z.string(), id: z.string(), width: z.number().positive(), height: z.number().positive() })),
});
