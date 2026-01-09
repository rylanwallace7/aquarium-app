function ParameterCard({ icon, label, value, unit, status, isDown, isDisabled }) {
  // Determine if status is good or bad
  const isGood = ['Normal', 'OK', 'Active', 'Water OK'].includes(status)
  const isBad = ['Too Low', 'Too High', 'Alert', 'Water Low', 'Critical', 'down'].includes(status) || isDown
  const isNoData = status === 'No Data'

  // Card background based on status - disabled grey, down red
  const cardBg = isDisabled ? 'bg-slate-400' : isDown ? 'bg-red-500' : isNoData ? 'bg-slate-300' : isGood ? 'bg-kurz-green' : isBad ? 'bg-kurz-pink' : 'bg-kurz-yellow'

  // Status text
  const statusText = isDisabled ? 'DISABLED' : isDown ? 'OFFLINE' : status

  return (
    <div className={`param-card ${cardBg}`}>
      <div className="flex justify-between items-start relative z-10">
        <span className="material-symbols-outlined text-xl font-black text-white">{icon}</span>
        <div className="bg-kurz-dark text-white px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide">
          {label}
        </div>
      </div>
      <div className="mt-3 relative z-10">
        <span className="text-2xl font-black tracking-tighter text-white">
          {value}
          {unit && <span className="text-sm ml-0.5">{unit}</span>}
        </span>
        <p className="text-kurz-dark font-bold uppercase text-[8px] mt-1 tracking-wider">
          {statusText}
        </p>
      </div>
    </div>
  )
}

export default ParameterCard
