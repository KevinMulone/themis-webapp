import Image from 'next/image';

export default function BrandHero({ titolo }: { titolo?: string }) {
  return (
    <div className="mb-7 flex flex-col items-center text-center">
      <Image
        src="/icon.svg"
        alt="Themis"
        width={64}
        height={64}
        priority
        className="rounded-[18px] shadow-[0_16px_40px_-18px_rgba(107,29,57,.55)]"
      />
      <p className="mt-5 text-[28px] font-semibold tracking-tight text-neutral-900">
        {titolo ?? 'Themis'}
      </p>
    </div>
  );
}
