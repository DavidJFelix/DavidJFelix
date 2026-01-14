import {docsSchema, i18nSchema} from '@astrojs/starlight/schema'
import {defineCollection, z} from 'astro:content'

// New blog collection schema (will replace Starlight docs for blog posts)
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

// New pages collection schema (for standalone pages like About)
const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
})

export const collections = {
  // Existing Starlight collections (will be removed in Phase 7)
  docs: defineCollection({schema: docsSchema()}),
  i18n: defineCollection({type: 'data', schema: i18nSchema()}),
  // New collections
  blog,
  pages,
}
