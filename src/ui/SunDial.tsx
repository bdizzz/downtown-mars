// The HUD's sun/moon dial (T-021), like the moon-phase window on an analog clock: a disc carrying
// the sun on one side and the moon on the other turns once a sol behind a half-round window, so the
// sun rides over the horizon by day and the moon by night. `dayFraction` is 0 at midnight.

export function SunDial({ dayFraction }: { dayFraction: number }) {
  // Noon puts the sun at the top; 06:00 has it rising on the left, 18:00 setting on the right.
  const turn = (dayFraction - 0.5) * 360;
  const day = dayFraction > 0.25 && dayFraction < 0.75;
  return (
    <svg className="sundial" width="26" height="15" viewBox="-13 -13 26 15" aria-hidden="true">
      <defs>
        <clipPath id="sundial-window">
          <rect x="-12" y="-12" width="24" height="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#sundial-window)">
        <circle r="12" className={day ? "sky day" : "sky night"} />
        <g transform={`rotate(${turn})`}>
          <circle cy="-7.5" r="3.4" className="sun" />
          <g transform="translate(0 7.5) rotate(180)">
            <circle r="3.2" className="moon" />
            <circle cx="1.5" cy="-0.8" r="2.6" className={day ? "moon-cut day" : "moon-cut night"} />
          </g>
        </g>
      </g>
      <line x1="-12.5" y1="0.5" x2="12.5" y2="0.5" className="horizon" />
    </svg>
  );
}
