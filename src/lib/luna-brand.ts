export const lunaBrandMark = '/images/luna-ribbon-v19-mark.png';
export const lunaBrandMotion = '/images/luna-ribbon-v19.mp4';

export const lunaBrandIcons = {
  icon: [16, 32, 48].map(size => ({
    url: `/icons/luna-ribbon-v19-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
  })),
  apple: [{ url: '/icons/luna-ribbon-v19-180.png', sizes: '180x180', type: 'image/png' }],
};
