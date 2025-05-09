import React from 'react';

export default function PieChart({ data, total, loading = false }) {

  const colors = [
    '#3182ce', '#38a169', '#ffb703', '#e53e3e', '#805ad5', '#718096'
  ];
  let startAngle = 0;
  const slices = data.map((bin, idx) => {
    const percent = total > 0 ? (bin.count / total) : 0;
    const angle = percent * 360;
    const endAngle = startAngle + angle;

    const startRad = (Math.PI / 180) * (startAngle - 90);
    const endRad = (Math.PI / 180) * (endAngle - 90);

    const x1 = 100 + 90 * Math.cos(startRad);
    const y1 = 100 + 90 * Math.sin(startRad);
    const x2 = 100 + 90 * Math.cos(endRad);
    const y2 = 100 + 90 * Math.sin(endRad);
    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = `M100,100 L${x1},${y1} A90,90 0 ${largeArcFlag} 1 ${x2},${y2} Z`;

    const slice = {
      pathData,
      color: colors[idx % colors?.length],
      percent: percent * 100,
      label: bin.label,
      count: bin.count
    };
    startAngle = endAngle;
    return slice;
  });

  const allZero = data.every(bin => bin.count === 0);

  return (
    <div style={{ width: 260, margin: '0 auto', padding: 20 }}>
      <h3 style={{ textAlign: 'center', marginBottom: 12, color: '#2d3748' }}>
        EV Charging Stations by Distance
        {loading && (
          <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #3182ce', borderTopColor: 'transparent', display: 'inline-block', marginLeft: 10, animation: 'spin 1s linear infinite' }} />
        )}
      </h3>
      {(!data || data.length === 0 || allZero) ? (
        <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7fafc', color: '#a0aec0', borderRadius: 100, margin: '0 auto', fontWeight: 500, fontSize: 18 }}>
          No charging station data to display
        </div>
      ) : (
        <svg width={200} height={200} viewBox="0 0 200 200" style={{ display: 'block', margin: '0 auto' }}>
          {slices.filter(s => s.percent > 0).length === 1 ? (
            <circle
              cx={100}
              cy={100}
              r={90}
              fill={slices.find(s => s.percent > 0).color}
            />
          ) : (
            slices?.map((slice, idx) => (
              <path
                key={idx}
                d={slice.pathData}
                fill={slice.color}
                stroke="#fff"
                strokeWidth={2}
                style={{ transition: 'fill 0.3s' }}
              />
            ))
          )}
          <circle cx={100} cy={100} r={55} fill="#f7fafc" />
        </svg>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        {slices.map((slice, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <span style={{ width: 16, height: 16, background: slice.color, borderRadius: '50%', display: 'inline-block' }}></span>
            <span style={{ color: '#2d3748', minWidth: 74, fontWeight: 500 }}>{slice.label}</span>
            <span style={{ color: '#4a5568' }}>{slice.count} ({slice.percent.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', color: '#4a5568', marginTop: 10, fontSize: 15, fontWeight: 500, padding: '8px 0' }}>
        <b>Total:</b> {total} charging station{total !== 1 ? 's' : ''}
        {loading && <span style={{ marginLeft: 6, fontSize: 14, color: '#718096' }}>(updating...)</span>}
      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
