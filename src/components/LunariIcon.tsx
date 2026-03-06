import Image from 'next/image';

interface LunariIconProps {
  size?: number;
  className?: string;
}

export default function LunariIcon({ size = 16, className }: LunariIconProps) {
  return (
    <Image
      src="/images/lunari-coin.png"
      alt="Lunari"
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
