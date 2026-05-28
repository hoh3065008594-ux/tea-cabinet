interface Props { online: boolean; device: string; }

export default function Hero({ online, device }: Props) {
  return (
    <div className="bg-white border-b border-[#e0e0e0] pt-12 pb-10 px-8 text-center">
      <div className="inline-flex items-center gap-1.5 bg-[#f0f0f0] rounded-full py-1 px-3.5 text-[13px] text-[#7a7a7a] mb-5">
        <span className={`w-[7px] h-[7px] rounded-full ${online ? 'bg-[#34c759]' : 'bg-[#e0e0e0]'}`} />
        {online ? '设备在线' : '设备离线'} · {device}
      </div>
      <h1 className="text-[32px] sm:text-[48px] font-semibold tracking-[-0.5px] mb-1">储茶柜</h1>
      <p className="text-[16px] sm:text-[19px] text-[#7a7a7a]">温湿度实时监测</p>
    </div>
  );
}
