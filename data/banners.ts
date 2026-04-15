export type Banner = {
  folder: 'bar-section' | 'cafe-section' | 'restaurant-folder';
  object_name: string;
  public_url: string;
  category: 'bar' | 'cafe' | 'restaurant';
};

const BASE_BANNER_URL =
  'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/promotional-banners/';

const folderToCategory = (folder: string): Banner['category'] => {
  if (folder.includes('bar')) return 'bar';
  if (folder.includes('cafe')) return 'cafe';
  return 'restaurant';
};

const encodeObjectName = (objectName: string) =>
  objectName.split('/').map(encodeURIComponent).join('/');

const rawBanners = [
  {
    folder: 'bar-section',
    object_name:
      'bar-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0002.webp',
  },
  {
    folder: 'bar-section',
    object_name: 'bar-section/Bar Banner_Final_page-0001.webp',
  },
  {
    folder: 'bar-section',
    object_name: 'bar-section/Bar Banner_Final_page-0002.webp',
  },
  {
    folder: 'bar-section',
    object_name: 'bar-section/Bar Banner_Final_page-0003.webp',
  },
  {
    folder: 'bar-section',
    object_name: 'bar-section/Bar Banner_Final_page-0004.webp',
  },
  {
    folder: 'bar-section',
    object_name: 'bar-section/Bar Banner_Final_page-0005.webp',
  },
  {
    folder: 'bar-section',
    object_name: 'bar-section/Bar Banner_Final_page-0006.webp',
  },
  {
    folder: 'cafe-section',
    object_name:
      'cafe-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0003.webp',
  },
  {
    folder: 'cafe-section',
    object_name: 'cafe-section/Restaurant Banner_Final_page-0001.webp',
  },
  {
    folder: 'cafe-section',
    object_name:
      'cafe-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0004.webp',
  },
  {
    folder: 'cafe-section',
    object_name:
      'cafe-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0005.webp',
  },
  {
    folder: 'cafe-section',
    object_name:
      'cafe-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0006.webp',
  },
  {
    folder: 'cafe-section',
    object_name:
      'cafe-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0011.webp',
  },
  {
    folder: 'cafe-section',
    object_name:
      'cafe-section/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0012.webp',
  },
  {
    folder: 'restaurant-folder',
    object_name:
      'restaurant-folder/Promotion Poster App (Cafe&Resort) (408x200 mm) (612 x 300 px)_page-0001.webp',
  },
  {
    folder: 'restaurant-folder',
    object_name: 'restaurant-folder/Restaurant Banner_Final_page-0002.webp',
  },
  {
    folder: 'restaurant-folder',
    object_name: 'restaurant-folder/Restaurant Banner_Final_page-0003.webp',
  },
  {
    folder: 'restaurant-folder',
    object_name: 'restaurant-folder/Restaurant Banner_Final_page-0004.webp',
  },
  {
    folder: 'restaurant-folder',
    object_name: 'restaurant-folder/Restaurant Banner_Final_page-0005.webp',
  },
  {
    folder: 'restaurant-folder',
    object_name: 'restaurant-folder/Restaurant Banner_Final_page-0006.webp',
  },
];

const banners: Banner[] = rawBanners.map((banner) => ({
  ...banner,
  public_url: `${BASE_BANNER_URL}${encodeObjectName(banner.object_name)}`,
  category: folderToCategory(banner.folder),
}));

export default banners;
