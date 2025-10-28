import React from 'react';

function CalibrationUI({ verticalOffset, setVerticalOffset, scaleFactor, setScaleFactor }) {
  return (
    <div className="calibration-ui">
      <label>
        Vertical Offset: {verticalOffset.toFixed(2)}
        <input
          type="range"
          min="-3"
          max="3"
          step="0.01"
          value={verticalOffset}
          onChange={(e) => setVerticalOffset(parseFloat(e.target.value))}
        />
      </label>
      <label>
        Scale: {scaleFactor.toFixed(2)}
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.01"
          value={scaleFactor}
          onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}

export default CalibrationUI;
