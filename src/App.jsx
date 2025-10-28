import React, { useState } from 'react';
import HatTryOn from './components/HatTryOn';
import CalibrationUI from './components/CaliberationUi';
import ModelPicker from './components/ModelPicker';
import { useCameraDevices } from './hooks/useCameraDevices';

function App() {
  const [selectedModel, setSelectedModel] = useState('/models/hat1.glb');
  const [verticalOffset, setVerticalOffset] = useState(0.0);
  const [scaleFactor, setScaleFactor] = useState(1.0);

  // Get video input devices
  const { devices: cameraDevices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();

  return (
    <div className="hat-tryon-container">
      <HatTryOn 
        modelPath={selectedModel} 
        verticalOffset={verticalOffset} 
        scaleFactor={scaleFactor} 
        deviceId={selectedDeviceId} 
      />
      <div className="controls">
        {/* Camera selection if multiple cameras are available */}
        {cameraDevices.length > 0 && (
          <label>
            Camera:
            <select
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              value={selectedDeviceId || ''}
            >
              {cameraDevices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <CalibrationUI 
          verticalOffset={verticalOffset} 
          setVerticalOffset={setVerticalOffset}
          scaleFactor={scaleFactor}
          setScaleFactor={setScaleFactor}
        />
        <ModelPicker onSelect={(model) => setSelectedModel(model)} />
      </div>
    </div>
  );
}

export default App;
