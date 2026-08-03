import type { CollectionConfig } from 'payload'

export const CrawlLogs: CollectionConfig = {
  slug: 'crawl-logs',
  dbName: 'cms_crawl_logs',
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['level', 'message', 'crawlJob', 'createdAt'],
  },
  fields: [
    {
      name: 'crawlJob',
      type: 'relationship',
      relationTo: 'crawl-jobs',
      required: true,
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      options: [
        { label: 'INFO', value: 'INFO' },
        { label: 'WARNING', value: 'WARNING' },
        { label: 'ERROR', value: 'ERROR' },
      ],
    },
    { name: 'message', type: 'textarea', required: true },
  ],
}
