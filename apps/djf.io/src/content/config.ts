import {defineCollection, z} from 'astro:content'

const blog = defineCollection({
  type: 'content',
  schema: ({image}) =>
    z.object({
      title: z.string(),
      description: z.string(),
      author: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      tagline: z.string().optional(),
      heroImageUrl: image().optional(),
      draft: z.boolean().default(false),
      aiAssistants: z
        .array(
          z.object({
            name: z.string(),
            details: z.string(),
          }),
        )
        .optional(),
    }),
})

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
})

export const collections = {
  blog,
  pages,
}
