/**
 * Site-wide config: contact and social URLs.
 * Change these in one place to update footer, header, and links.
 */
export const site = {
  contactEmail: 'julian@thoughtform.world',
  instagramUrl: 'https://instagram.com/thoughtform_',
  soundcloudUrl: 'https://soundcloud.com/thoughtformww',
  /** Site description for meta and OpenGraph. */
  description:
    'Thoughtform Worldwide — boutique development studio for creators and brands building what\'s next.',
  /** Site title for meta and OpenGraph. */
  title: 'Thoughtform Worldwide',
  /** Umami (https://cloud.umami.is) — website ID from the Umami dashboard. */
  umamiWebsiteId: 'efcfa827-c1d1-44eb-86e7-ce82f38a6764',
} as const;

export type SiteConfig = typeof site;
