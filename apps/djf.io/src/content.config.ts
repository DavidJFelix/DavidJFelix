import {defineCollection, type SchemaContext} from 'astro:content'
import {glob} from 'astro/loaders'
import {z} from 'astro/zod'

export const blogSchema = ({image}: SchemaContext) =>
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
        }),
      )
      .optional(),
  })

const blog = defineCollection({
  loader: glob({pattern: '**/*.md', base: './src/content/blog'}),
  schema: blogSchema,
})

export const collections = {
  blog,
}
