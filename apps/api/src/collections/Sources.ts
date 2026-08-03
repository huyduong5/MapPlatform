import type { CollectionConfig } from 'payload'

export const Sources: CollectionConfig = {
  slug: 'sources',
  dbName: 'cms_sources',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'status', 'updatedAt'],
    description: 'CMS mirror — dữ liệu crawl production nằm ở bảng SQL `sources` (migration).',
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Official website', value: 'official_website' },
        { label: 'OpenStreetMap', value: 'openstreetmap' },
        { label: 'External API', value: 'external_api' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'url', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    { name: 'lastCrawledAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
