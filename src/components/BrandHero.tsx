import Image from 'next/image';

export default function BrandHero() {
  return (
    <div className="mb-5 flex justify-center">
      <Image src="/themis-emblem.svg" alt="Themis" width={220} height={138} priority />
    </div>
  );
}
