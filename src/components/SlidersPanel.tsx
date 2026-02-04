import { useState } from 'react';

type SliderConfig = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
};

export function SlidersPanel(): JSX.Element {
  const [sliders, setSliders] = useState<SliderConfig[]>([
    { id: 'dithering', label: 'Dithering', value: 0, min: 0, max: 10 },
    { id: 'resolution', label: 'Resolution', value: 4, min: 0, max: 10 },
    { id: 'pixelation', label: 'Pixelation', value: 1, min: 0, max: 10 },
  ]);

  const updateValue = (id: string, value: number): void => {
    setSliders((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value } : s))
    );
  };

  return (
    <div className="rounded-lg border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur">
      {sliders.map(({ id, label, value, min, max }) => (
        <div key={id} className="mb-3 last:mb-0">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{label}</span>
            <span>{value}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => updateValue(id, Number(e.target.value))}
            className="h-1.5 w-full accent-black"
          />
        </div>
      ))}
    </div>
  );
}
