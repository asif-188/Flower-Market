import { useState, useEffect, useRef, useCallback } from 'react';

// Configuration keys for localStorage settings
const STORAGE_KEYS = {
  METHOD: 'wm_conn_method',
  BAUD: 'wm_conn_baud',
  IP: 'wm_conn_ip',
  BT_SERVICE: 'wm_conn_bt_service',
  BT_CHAR: 'wm_conn_bt_char',
};

// Simulation weight sequence as requested
const SIMULATION_WEIGHTS = [9.850, 10.000, 10.250, 12.500];

export function useWeightMachine() {
  const [weight, setWeight] = useState(0.000);
  const [status, setStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [logs, setLogs] = useState([]);
  const [method, setMethod] = useState(() => localStorage.getItem(STORAGE_KEYS.METHOD) || 'usb');
  const [baudRate, setBaudRate] = useState(() => localStorage.getItem(STORAGE_KEYS.BAUD) || '9600');
  const [ipAddress, setIpAddress] = useState(() => localStorage.getItem(STORAGE_KEYS.IP) || 'ws://127.0.0.1:8080');
  const [btService, setBtService] = useState(() => localStorage.getItem(STORAGE_KEYS.BT_SERVICE) || '0000ffe0-0000-1000-8000-00805f9b34fb');
  const [btChar, setBtChar] = useState(() => localStorage.getItem(STORAGE_KEYS.BT_CHAR) || '0000ffe1-0000-1000-8000-00805f9b34fb');
  
  const [isSimulating, setIsSimulating] = useState(false);
  const simIndexRef = useRef(0);
  const simIntervalRef = useRef(null);

  // Hardware references
  const serialPortRef = useRef(null);
  const serialReaderRef = useRef(null);
  const btDeviceRef = useRef(null);
  const wsRef = useRef(null);

  // Helper to add timestamped logs
  const addLog = useCallback((type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] [${type}] ${message}`, ...prev].slice(0, 100));
  }, []);

  // Persist settings
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.METHOD, method); }, [method]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BAUD, baudRate); }, [baudRate]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.IP, ipAddress); }, [ipAddress]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BT_SERVICE, btService); }, [btService]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BT_CHAR, btChar); }, [btChar]);

  // Parse weight string using regex to extract decimal/integer weights
  const parseWeightString = useCallback((rawString) => {
    // Looks for floats or integers, e.g., +010.250, 9.85, 12.500, etc.
    const match = rawString.match(/(-|\+)?\d+(\.\d+)?/);
    if (match) {
      const val = parseFloat(match[0]);
      if (!isNaN(val)) {
        setWeight(val);
      }
    }
  }, []);

  // --- Clean Up Connections ---
  const disconnect = useCallback(async () => {
    // 1. Stop simulation
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);

    // 2. Serial
    if (serialReaderRef.current) {
      try {
        await serialReaderRef.current.cancel();
      } catch (e) {
        console.error(e);
      }
      serialReaderRef.current = null;
    }
    if (serialPortRef.current) {
      try {
        await serialPortRef.current.close();
      } catch (e) {
        console.error(e);
      }
      serialPortRef.current = null;
    }

    // 3. Bluetooth
    if (btDeviceRef.current && btDeviceRef.current.gatt.connected) {
      try {
        btDeviceRef.current.gatt.disconnect();
      } catch (e) {
        console.error(e);
      }
      btDeviceRef.current = null;
    }

    // 4. WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.error(e);
      }
      wsRef.current = null;
    }

    setStatus('disconnected');
    addLog('SYSTEM', 'Disconnected from weight machine.');
  }, [addLog]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // --- Web Serial Connection (USB / RS232) ---
  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      addLog('ERROR', 'Web Serial API not supported in this browser. Use Chrome/Edge.');
      alert('❌ Web Serial API not supported in this browser.');
      return;
    }

    try {
      setStatus('connecting');
      addLog('SERIAL', 'Requesting serial port access...');
      const port = await navigator.serial.requestPort();
      serialPortRef.current = port;

      addLog('SERIAL', `Opening port with Baud Rate: ${baudRate}...`);
      await port.open({ baudRate: parseInt(baudRate, 10) });
      setStatus('connected');
      addLog('SERIAL', 'Connected to port successfully.');

      // Start reading loop
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          addLog('SERIAL', 'Reader stream closed.');
          break;
        }
        if (value) {
          buffer += value;
          // Split by newline or Carriage Return
          const lines = buffer.split(/[\r\n]+/);
          // Keep the last partial line in the buffer
          buffer = lines.pop();

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine) {
              addLog('RAW-IN', cleanLine);
              parseWeightString(cleanLine);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      addLog('ERROR', `Serial connection failed: ${err.message || err}`);
      setStatus('disconnected');
    }
  }, [baudRate, addLog, parseWeightString]);

  // --- Web Bluetooth Connection ---
  const connectBluetooth = useCallback(async () => {
    if (!('bluetooth' in navigator)) {
      addLog('ERROR', 'Web Bluetooth API not supported in this browser. Use Chrome/Edge.');
      alert('❌ Web Bluetooth API not supported in this browser.');
      return;
    }

    try {
      setStatus('connecting');
      addLog('BLUETOOTH', 'Scanning for Bluetooth devices...');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [btService]
      });

      btDeviceRef.current = device;
      addLog('BLUETOOTH', `Connecting to device GATT Server: ${device.name}...`);
      const server = await device.gatt.connect();

      addLog('BLUETOOTH', `Accessing primary service: ${btService}...`);
      const service = await server.getPrimaryService(btService);

      addLog('BLUETOOTH', `Accessing characteristic: ${btChar}...`);
      const characteristic = await service.getCharacteristic(btChar);

      setStatus('connected');
      addLog('BLUETOOTH', 'Connected successfully. Listening to notify...');

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value).trim();
        if (text) {
          addLog('RAW-IN', text);
          parseWeightString(text);
        }
      });
    } catch (err) {
      console.error(err);
      addLog('ERROR', `Bluetooth connection failed: ${err.message || err}`);
      setStatus('disconnected');
    }
  }, [btService, btChar, addLog, parseWeightString]);

  // --- WebSocket Connection (TCP/IP Bridge) ---
  const connectTCP = useCallback(async () => {
    try {
      setStatus('connecting');
      addLog('TCP/IP', `Connecting to WebSocket bridge: ${ipAddress}...`);
      const ws = new WebSocket(ipAddress);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        addLog('TCP/IP', 'WebSocket bridge connected.');
      };

      ws.onmessage = (event) => {
        const text = event.data.trim();
        if (text) {
          addLog('RAW-IN', text);
          parseWeightString(text);
        }
      };

      ws.onerror = (err) => {
        addLog('ERROR', 'WebSocket error occurred.');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        addLog('TCP/IP', 'WebSocket connection closed.');
      };
    } catch (err) {
      console.error(err);
      addLog('ERROR', `TCP/IP WebSocket connection failed: ${err.message || err}`);
      setStatus('disconnected');
    }
  }, [ipAddress, addLog, parseWeightString]);

  // --- Simulator Mode ---
  const startSimulation = useCallback(() => {
    disconnect();
    setIsSimulating(true);
    setStatus('connected');
    addLog('SIMULATOR', 'Weight Machine simulator started.');

    simIntervalRef.current = setInterval(() => {
      const nextWeight = SIMULATION_WEIGHTS[simIndexRef.current];
      setWeight(nextWeight);
      
      const rawFrame = `ST,GS,+${nextWeight.toFixed(3).padStart(7, '0')}kg`;
      addLog('RAW-IN', rawFrame);

      // Cycle to the next weight index
      simIndexRef.current = (simIndexRef.current + 1) % SIMULATION_WEIGHTS.length;
    }, 1000);
  }, [disconnect, addLog]);

  const stopSimulation = useCallback(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);
    setStatus('disconnected');
    addLog('SIMULATOR', 'Weight Machine simulator stopped.');
  }, [addLog]);

  const handleTestConnection = useCallback(async () => {
    addLog('TEST', `Testing connection for type: ${method.toUpperCase()}...`);
    if (method === 'usb' || method === 'rs232') {
      await connectSerial();
    } else if (method === 'bluetooth') {
      await connectBluetooth();
    } else if (method === 'tcp') {
      await connectTCP();
    }
  }, [method, connectSerial, connectBluetooth, connectTCP, addLog]);

  const triggerSimulateWeight = useCallback(() => {
    // Generate a single custom mock reading or step once through weights
    const nextWeight = SIMULATION_WEIGHTS[simIndexRef.current];
    setWeight(nextWeight);
    addLog('SIMULATOR', `Manual Simulated weight read: ${nextWeight.toFixed(3)} KG`);
    simIndexRef.current = (simIndexRef.current + 1) % SIMULATION_WEIGHTS.length;
  }, [addLog]);

  return {
    weight,
    setWeight,
    status,
    logs,
    clearLogs: () => setLogs([]),
    method,
    setMethod,
    baudRate,
    setBaudRate,
    ipAddress,
    setIpAddress,
    btService,
    setBtService,
    btChar,
    setBtChar,
    isSimulating,
    startSimulation,
    stopSimulation,
    disconnect,
    handleTestConnection,
    triggerSimulateWeight,
  };
}
