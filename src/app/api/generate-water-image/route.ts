import waterImages from '@/lib/water-images.json';

export async function POST() {
  try {
    const randomImage = waterImages[Math.floor(Math.random() * waterImages.length)];

    return Response.json({
      imageUrl: randomImage.url,
      credit: randomImage.credit,
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return Response.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
