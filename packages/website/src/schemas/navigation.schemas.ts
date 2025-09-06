import { z } from '@hono/zod-openapi'

/**
 * Navigation menu item base schema (without recursion)
 */
const NavigationItemBaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  target: z.enum(['_self', '_blank']).optional().default('_self'),
  icon: z.string().optional(),
  badge: z.string().optional()
}).openapi('NavigationItemBase')

/**
 * Navigation menu item schema with limited depth (non-recursive for OpenAPI)
 */
export const NavigationItemSchema = NavigationItemBaseSchema.extend({
  children: z.array(NavigationItemBaseSchema.extend({
    children: z.array(NavigationItemBaseSchema).optional()
  })).optional()
}).openapi('NavigationItem', {
  description: 'Navigation menu item with up to 2 levels of nesting',
  example: {
    id: 'example',
    label: 'Example Item',
    href: '/example',
    target: '_self',
    children: [
      {
        id: 'child',
        label: 'Child Item',
        href: '/example/child'
      }
    ]
  }
})

/**
 * Navigation menu schema
 */
export const NavigationMenuSchema = z.object({
  items: z.array(NavigationItemSchema),
  logoText: z.string().optional(),
  logoHref: z.string().default('/')
}).openapi('NavigationMenu', {
  description: 'Main navigation menu configuration'
})

/**
 * Footer navigation section schema
 */
const FooterSectionSchema = z.object({
  title: z.string(),
  items: z.array(NavigationItemSchema)
}).openapi('FooterSection')

/**
 * Social link schema
 */
const SocialLinkSchema = z.object({
  platform: z.enum(['github', 'discord', 'twitter', 'linkedin']),
  url: z.string().url(),
  label: z.string()
}).openapi('SocialLink')

/**
 * Footer navigation schema
 */
export const FooterNavigationSchema = z.object({
  sections: z.array(FooterSectionSchema),
  copyright: z.string(),
  socialLinks: z.array(SocialLinkSchema)
}).openapi('FooterNavigation', {
  description: 'Footer navigation configuration'
})

// Type exports
export type NavigationItem = z.infer<typeof NavigationItemSchema>
export type NavigationMenu = z.infer<typeof NavigationMenuSchema>
export type FooterNavigation = z.infer<typeof FooterNavigationSchema>
