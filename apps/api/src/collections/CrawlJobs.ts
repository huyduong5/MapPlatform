import type { CollectionConfig } from 'payload'

export const CrawlJobs: CollectionConfig = {
  slug: 'crawl-jobs',
  dbName: 'cms_crawl_jobs',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['source', 'status', 'startedAt', 'recordsFound'],
  },
  fields: [
    {
      name: 'source',
      type: 'relationship',
      relationTo: 'sources',
      required: true,
    },
    { name: 'startedAt', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'finishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Running', value: 'running' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'recordsFound', type: 'number', defaultValue: 0 },
    { name: 'recordsCreated', type: 'number', defaultValue: 0 },
    { name: 'recordsUpdated', type: 'number', defaultValue: 0 },
    { name: 'recordsDeactivated', type: 'number', defaultValue: 0 },
    { name: 'errorMessage', type: 'textarea' },
  ],
}
