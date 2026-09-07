import Image from 'next/image';

export default function BrandHero({ titolo }: { titolo?: string }) {
  return (
    <div className="mb-7 flex flex-col items-center text-center">
      <Image
        src="/icon.svg"
        alt="Themis"
        width={72}
        height={72}
        priority
        className="rounded-[20px] shadow-[0_18px_40px_-16px_rgba(46,12,24,.65)]"
      />
      <p className="mt-5 text-[28px] font-semibold tracking-tight text-neutral-900">
        {titolo ?? 'Themis'}
      </p>
    </div>
  );
}
