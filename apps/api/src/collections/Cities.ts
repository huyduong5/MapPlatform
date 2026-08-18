import type { CollectionConfig } from 'payload'
import { invalidateCitiesCache } from '@/lib/citiesStore'

/** Source of truth for map/crawler city config — edit in Admin, not in code. */
export const Cities: CollectionConfig = {
  slug: 'cities',
  dbName: 'cms_cities',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['code', 'name', 'enabled', 'order', 'updatedAt'],
    description:
      'Cấu hình tỉnh/thành cho map + crawl. Hardcode trong code chỉ còn seed/fallback khi DB trống.',
  },
  hooks: {
    afterChange: [
      () => {
        invalidateCitiesCache()
      },
    ],
    afterDelete: [
      () => {
        invalidateCitiesCache()
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Slug ổn định (hanoi, hcm, …) — crawler/API dùng field này.' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'latitude', type: 'number', required: true },
    { name: 'longitude', type: 'number', required: true },
    { name: 'zoom', type: 'number', required: true, defaultValue: 12 },
    {
      name: 'bbox',
      type: 'group',
      required: true,
      fields: [
        { name: 'minLat', type: 'number', required: true },
        { name: 'maxLat', type: 'number', required: true },
        { name: 'minLng', type: 'number', required: true },
        { name: 'maxLng', type: 'number', required: true },
      ],
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Tắt để ẩn khỏi map switcher / không crawl mặc định.' },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Thứ tự hiển thị (nhỏ hơn = trước).' },
    },
  ],
}
