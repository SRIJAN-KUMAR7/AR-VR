import React, { useState } from 'react';
const HATS = [
  { name: 'Hat 1', file: '/models/hat1.glb', thumbnail: '/assets/hat1_thumb.png' },
  { name: 'Hat 2', file: '/models/hat2.glb', thumbnail: '/assets/hat2_thumb.png' },
];

function ModelPicker({ onSelect }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="model-picker">
      {HATS.map((hat, idx) => (
        <img
          key={idx}
          src={hat.thumbnail}
          alt={hat.name}
          className={selectedIndex === idx ? 'selected' : ''}
          onClick={() => {
            setSelectedIndex(idx);
            onSelect(hat.file);
          }}
        />
      ))}
    </div>
  );
}

export default ModelPicker;
