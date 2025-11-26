import Constants from 'expo-constants';

const getBaseUrl = () => {
  // 1. If we are in a Production environment (e.g., App Store build), return the real server URL.
  if (process.env.NODE_ENV === 'production') {
    return 'https://your-production-server.com/api';
  }

  // 2. Get the Host URI (The IP of the computer running Metro Bundler)
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];

  if (localhost) {
    // If running on a physical device or emulator connected to the Metro server,
    // this returns the dynamic IP (e.g., 192.168.x.x)
    return `http://${localhost}:8000/api`;
  }

  // 3. Fallback for iOS Simulator or if host is undetectable
  return 'http://localhost:8000/api';
};

export const API_URL = getBaseUrl();
export const LOGIN_URL = `${API_URL}/login`;