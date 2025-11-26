import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// IMPORT ROUTER
import { useRouter } from 'expo-router';

// --- TYPES ---
interface User {
  kod_pengguna_id: number;
  no_tentera: string;
  name: string;
  email: string;
  no_tel_pengguna: string;
  pangkat_id?: number;
  user_role_id?: number;
  pasukan_id?: number;
  creation_time: string;
  is_approved?: number;
}

interface LoginResponse {
  status: string;
  message: string;
  user?: User;
}

export default function LoginScreen() {
  const router = useRouter(); // Initialize Router

  // State for form inputs
  const [email, setEmail] = useState<string>('admin@example.com');
  const [password, setPassword] = useState<string>('password');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // YOUR API CONFIGURATION
  // Ensure your phone/emulator can reach this IP
  const API_URL = 'http://192.168.49.90:8000/api/login';

  const handleLogin = async () => {
    // 1. Basic validation
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      console.log(`[FMS] Connecting to: ${API_URL}`);

      // 2. Fetch Request
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      // 3. Parse Response
      const data: LoginResponse = await response.json();
      console.log('[FMS] Response:', data);

      if (response.ok && data.status === 'success') {
        // --- SUCCESS LOGIC ---

        // Navigate to dashboard and pass user data as a string
        router.replace({
          pathname: '/dashboard',
          params: { userData: JSON.stringify(data.user) }
        });

      } else {
        // --- SERVER ERROR ---
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
      }

    } catch (error) {
      // --- NETWORK ERROR ---
      console.error(error);
      Alert.alert(
        'Connection Error',
        'Could not reach the FMS Server.\n\nCheck:\n1. Your phone is on the same Wi-Fi.\n2. The IP 172.27.156.90 is correct.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />

      {/* BACKGROUND DECORATION */}
      <View style={styles.bgDecorationCircle} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <SafeAreaView style={styles.safeArea}>

          {/* HEADER SECTION */}
          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark-outline" size={40} color="#fff" />
            </View>
            <Text style={styles.appTitle}>FMS MOBILE</Text>
            <Text style={styles.appSubtitle}>Fleet Movement System</Text>
          </View>

          {/* FORM CONTAINER */}
          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.instructionText}>Enter your military credentials to continue.</Text>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? (
                    <Ionicons name="eye-off-outline" size={20} color="#64748b" />
                  ) : (
                    <Ionicons name="eye-outline" size={20} color="#64748b" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={loading}
              style={styles.shadowButton}
            >
              <LinearGradient
                colors={['#1e40af', '#3b82f6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign In</Text>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotButton}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Version 1.0.0 • Authorized Personnel Only</Text>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  bgDecorationCircle: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#1e3a8a',
    opacity: 0.2,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  formContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 32,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeIcon: {
    padding: 4,
  },
  shadowButton: {
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientButton: {
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 10,
    opacity: 0.6,
  },
});