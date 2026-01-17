import {defineCollection, z} from 'astro:content'

const blog = defineCollection({
  type: 'content',
  schema: ({image}) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      readingTime: z.string().optional(),
      hero: z
        .object({
          tagline: z.string().optional(),
          image: z
            .object({
              file: image(),
              alt: z.string(),
            })
            .optional(),
        })
        .optional(),
      aiAssistants: z
        .array(
          z.object({
            name: z.string(),
            details: z.string().optional(),
          })
        )
        .optional(),
    }),
})

export const collections = {
  blog,
}
