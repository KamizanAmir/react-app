import Constants, { ExecutionEnvironment } from 'expo-constants';
import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Modal,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
// import * as Notifications from 'expo-notifications'; // Removed for lazy loading
import * as Device from 'expo-device';

// --- TYPES ---
interface User {
    kod_pengguna_id: number;
    name: string;
    no_tentera: string;
    pangkat_id?: number;
    nama_pangkat?: string;
    nama_pasukan?: string;
    role_label?: string;
    user_role_id?: number;
    email?: string;
    no_tel_pengguna?: string;
}

interface TaskItem {
    id: number;
    ticket_number: string;
    task_type: string;
    date: string;
    driver_name: string;
    registration_number: string;
    current_status: string;
    created_at: string;
}

// --- CONFIG ---
const API_URL = 'http://192.168.49.90:8000/api';

export default function DashboardScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // STATE
    const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'history' | 'alerts'>('home');
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);

    // DATA STATE
    const [taskList, setTaskList] = useState<TaskItem[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // PARSE USER DATA
    let user: User = { kod_pengguna_id: 0, name: 'User', no_tentera: 'N/A' };
    if (params.userData) {
        try {
            user = JSON.parse(params.userData as string);
        } catch (e) {
            console.log("Error parsing user data");
        }
    }

    // HELPER: Initials
    const getInitials = (fullName: string) => {
        if (!fullName) return 'U';
        const names = fullName.split(' ');
        let initials = names[0].substring(0, 1).toUpperCase();
        if (names.length > 1) {
            initials += names[names.length - 1].substring(0, 1).toUpperCase();
        }
        return initials;
    };

    // --- FETCH TASKS (For Alerts Tab) ---
    const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
            // PASS USER ID AND ROLE ID PARAMS
            // Added '|| 0' to ensure we don't send undefined
            const queryParams = `?user_id=${user.kod_pengguna_id}&role_id=${user.user_role_id || 0}`;
            const response = await fetch(`${API_URL}/tasks${queryParams}`);

            const json = await response.json();
            if (json.status === 'success') {
                setTaskList(json.data);
            } else {
                console.log("Fetch error:", json.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingTasks(false);
            setRefreshing(false);
        }
    };

    // Refresh Handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchTasks();
    }, []);

    // Effect: Load tasks when switching to 'alerts' tab
    useEffect(() => {
        if (activeTab === 'alerts') {
            fetchTasks();
        }
    }, [activeTab]);

    // LOGOUT ACTION
    const confirmLogout = () => {
        setLogoutModalVisible(false);
        router.replace('/');
    };

    // --- PUSH NOTIFICATION SETUP ---
    useEffect(() => {
        // Only run this logic if we are NOT in Expo Go (StoreClient)
        if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
            // Lazy load the notification handler setup
            const Notifications = require('expo-notifications');

            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: false,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });

            registerForPushNotificationsAsync().then(token => {
                if (token) {
                    saveTokenToBackend(token);
                }
            });
        } else {
            console.log("Expo Go detected: Skipping Push Notification setup.");
        }
    }, []);

    const saveTokenToBackend = async (token: string) => {
        try {
            await fetch(`${API_URL}/update-push-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.kod_pengguna_id,
                    token: token
                })
            });
            console.log("Push Token Saved:", token);
        } catch (error) {
            console.log("Error saving token:", error);
        }
    };

    async function registerForPushNotificationsAsync() {
        let token;

        // 1. CHECK: If running in the standard Expo Go client, skip push setup
        if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
            console.log("Skipping Push Notification setup (Not supported in Expo Go).");
            return null;
        }

        // Lazy load Notifications module
        const Notifications = require('expo-notifications');

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                // If permission is denied, stop and return
                return;
            }

            try {
                token = (await Notifications.getExpoPushTokenAsync({
                    projectId: Constants.expoConfig?.extra?.eas?.projectId,
                })).data;
            } catch (e) {
                console.log("Error getting token:", e);
            }
        }
        return token;
    }

    // --- RENDERERS ---

    const renderHome = () => (
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* Stats Header */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                        <Ionicons name="document-text" size={24} color="#2563eb" />
                    </View>
                    <Text style={styles.statNumber}>{taskList.length}</Text>
                    <Text style={styles.statLabel}>Active Tasks</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                    </View>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
                        <Ionicons name="alert-circle" size={24} color="#dc2626" />
                    </View>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Issues</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.modulesGrid}>
                <TouchableOpacity style={styles.moduleCard} onPress={() => router.push('/create-task')}>
                    <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.moduleIcon}>
                        <Ionicons name="car-sport" size={24} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.moduleTitle}>Vehicle Request</Text>
                    <Text style={styles.moduleSub}>Apply for transport</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moduleCard}>
                    <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.moduleIcon}>
                        <Ionicons name="construct" size={24} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.moduleTitle}>Maintenance</Text>
                    <Text style={styles.moduleSub}>Report issues</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moduleCard}>
                    <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.moduleIcon}>
                        <Ionicons name="map" size={24} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.moduleTitle}>Tracking</Text>
                    <Text style={styles.moduleSub}>Live GPS view</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moduleCard}>
                    <LinearGradient colors={['#10b981', '#059669']} style={styles.moduleIcon}>
                        <Ionicons name="stats-chart" size={24} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.moduleTitle}>Reports</Text>
                    <Text style={styles.moduleSub}>View analytics</Text>
                </TouchableOpacity>
            </View>
            <View style={{ height: 100 }} />
        </ScrollView>
    );

    const renderAlerts = () => {
        if (loadingTasks && !refreshing) {
            return (
                <View style={styles.centerPlaceholder}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            );
        }

        // Check if current user is a Driver (Role 4)
        const isDriver = user.user_role_id === 4;

        return (
            <View style={styles.listContainer}>
                <Text style={styles.listHeaderTitle}>
                    {isDriver ? 'Penugasan Saya' : 'Penugasan'}
                </Text>

                <FlatList
                    data={taskList}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={styles.centerPlaceholder}>
                            <Ionicons name="documents-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.placeholderText}>No applications found.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                // Navigate to View Mode (passing taskId)
                                router.push({
                                    pathname: '/create-task',
                                    params: { taskId: item.id }
                                });
                            }}
                        >
                            <View style={styles.taskCard}>
                                {/* Top Row: Ticket # and Status */}
                                <View style={styles.taskHeader}>
                                    <View style={styles.ticketBadge}>
                                        <Text style={styles.ticketText}>#{item.ticket_number}</Text>
                                    </View>
                                    {/* Dynamic Status Badge Color */}
                                    <View style={[
                                        styles.statusBadge,
                                        item.current_status === 'Menunggu'
                                            ? { backgroundColor: '#fef3c7' }
                                            : { backgroundColor: '#dcfce7' }
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            item.current_status === 'Menunggu'
                                                ? { color: '#d97706' }
                                                : { color: '#16a34a' }
                                        ]}>
                                            {item.current_status}
                                        </Text>
                                    </View>
                                </View>

                                {/* Main Info */}
                                <Text style={styles.taskTitle}>{item.task_type}</Text>

                                <View style={styles.taskRow}>
                                    <Ionicons name="calendar-outline" size={16} color="#64748b" />
                                    <Text style={styles.taskDetail}>{item.date}</Text>
                                </View>

                                <View style={styles.divider} />

                                {/* Details */}
                                <View style={styles.taskRow}>
                                    <Ionicons name="person-outline" size={16} color="#64748b" />
                                    <Text style={styles.taskDetail}>Driver: {item.driver_name}</Text>
                                </View>
                                <View style={styles.taskRow}>
                                    <Ionicons name="car-outline" size={16} color="#64748b" />
                                    <Text style={styles.taskDetail}>Vehicle: {item.registration_number}</Text>
                                </View>

                                {/* --- ACTION BUTTONS FOR DRIVERS --- */}
                                {/* Only show if User is Driver (Role 4) AND Status is 'Menunggu' */}
                                {isDriver && item.current_status === 'Menunggu' && (
                                    <View style={styles.actionContainer}>
                                        <View style={styles.divider} />
                                        <View style={styles.buttonRow}>
                                            {/* REJECT BUTTON */}
                                            <TouchableOpacity
                                                style={styles.btnReject}
                                                activeOpacity={0.7}
                                                onPress={() => alert('Logic for REJECT coming soon')}
                                            >
                                                <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                                                <Text style={styles.btnRejectText}>Tolak</Text>
                                            </TouchableOpacity>

                                            {/* ACCEPT BUTTON */}
                                            <TouchableOpacity
                                                style={styles.btnAccept}
                                                activeOpacity={0.7}
                                                onPress={() => alert('Logic for ACCEPT coming soon')}
                                            >
                                                <LinearGradient
                                                    colors={['#16a34a', '#15803d']}
                                                    style={styles.btnAcceptGradient}
                                                >
                                                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                                                    <Text style={styles.btnAcceptText}>Terima</Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                {/* --- END ACTION BUTTONS --- */}
                            </View>
                        </TouchableOpacity>
                    )}
                />
            </View>
        );
    };

    const renderProfile = () => (
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.profileHeaderCard}>
                <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>{getInitials(user.name)}</Text>
                </View>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileRole}>{user.role_label || 'User'}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionHeader}>Military Details</Text>
                <View style={styles.row}>
                    <View style={styles.iconBoxSmall}><Ionicons name="id-card-outline" size={20} color="#2563eb" /></View>
                    <View>
                        <Text style={styles.label}>ID (No. Tentera)</Text>
                        <Text style={styles.value}>{user.no_tentera}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.row}>
                    <View style={styles.iconBoxSmall}><Ionicons name="ribbon-outline" size={20} color="#2563eb" /></View>
                    <View>
                        <Text style={styles.label}>Rank</Text>
                        <Text style={styles.value}>{user.nama_pangkat || '-'}</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.logoutButtonWrapper} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.8}>
                <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.logoutButtonGradient}>
                    <Ionicons name="log-out-outline" size={20} color="#fff" />
                    <Text style={styles.logoutText}>Log Out</Text>
                </LinearGradient>
            </TouchableOpacity>
            <View style={{ height: 100 }} />
        </ScrollView>
    );

    const renderPlaceholder = (title: string) => (
        <View style={styles.centerPlaceholder}>
            <Ionicons name="construct-outline" size={64} color="#cbd5e1" />
            <Text style={styles.placeholderText}>{title} Coming Soon</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* HEADER */}
            <LinearGradient colors={['#0f172a', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.greetingText}>
                                {activeTab === 'home' ? 'Welcome back,' : 'FMS Mobile'}
                            </Text>
                            <Text style={styles.userName}>
                                {activeTab === 'home' ? user.name : (activeTab.charAt(0).toUpperCase() + activeTab.slice(1))}
                            </Text>
                            {activeTab === 'home' && (
                                <View style={styles.idBadge}>
                                    <Text style={styles.idText}>ID: {user.no_tentera}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => setActiveTab('profile')}>
                            <View style={styles.headerAvatar}>
                                <Text style={styles.headerAvatarText}>{getInitials(user.name)}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* MAIN CONTENT */}
            <View style={{ flex: 1 }}>
                {activeTab === 'home' && renderHome()}
                {activeTab === 'profile' && renderProfile()}
                {activeTab === 'history' && renderPlaceholder('History')}
                {activeTab === 'alerts' && renderAlerts()}
            </View>

            {/* BOTTOM NAVIGATION */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
                    <Ionicons name={activeTab === 'home' ? "home" : "home-outline"} size={24} color={activeTab === 'home' ? "#2563eb" : "#64748b"} />
                    <Text style={[styles.navText, activeTab === 'home' && styles.activeNavText]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('alerts')}>
                    <Ionicons name={activeTab === 'alerts' ? "notifications" : "notifications-outline"} size={24} color={activeTab === 'alerts' ? "#2563eb" : "#64748b"} />
                    <Text style={[styles.navText, activeTab === 'alerts' && styles.activeNavText]}>Alerts</Text>
                </TouchableOpacity>

                <View style={styles.centerBtnWrapper}>
                    <TouchableOpacity style={styles.centerBtn} activeOpacity={0.8} onPress={() => router.push('/create-task')}>
                        <LinearGradient colors={['#2563eb', '#1e40af']} style={styles.centerBtnGradient}>
                            <Ionicons name="add" size={32} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('history')}>
                    <Ionicons name={activeTab === 'history' ? "time" : "time-outline"} size={24} color={activeTab === 'history' ? "#2563eb" : "#64748b"} />
                    <Text style={[styles.navText, activeTab === 'history' && styles.activeNavText]}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
                    <Ionicons name={activeTab === 'profile' ? "person" : "person-outline"} size={24} color={activeTab === 'profile' ? "#2563eb" : "#64748b"} />
                    <Text style={[styles.navText, activeTab === 'profile' && styles.activeNavText]}>Profile</Text>
                </TouchableOpacity>
            </View>

            {/* LOGOUT MODAL */}
            <Modal animationType="fade" transparent={true} visible={logoutModalVisible} onRequestClose={() => setLogoutModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconContainer}><Ionicons name="power" size={32} color="#ef4444" /></View>
                        <Text style={styles.modalTitle}>Log Out</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to exit the application?</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setLogoutModalVisible(false)}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnConfirmWrapper} onPress={confirmLogout}>
                                <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.btnConfirm}>
                                    <Text style={styles.btnConfirmText}>Yes, Logout</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    greetingText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
    userName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginVertical: 4 },
    idBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    idText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
    headerAvatar: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
    headerAvatarText: { color: '#1e3a8a', fontWeight: 'bold', fontSize: 16 },

    contentContainer: { flex: 1, paddingHorizontal: 20, marginTop: -20 },
    listContainer: { flex: 1, paddingHorizontal: 20, marginTop: -20 },
    listHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, marginTop: 20 },

    // TASK CARD STYLES
    taskCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ticketBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    ticketText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    taskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    taskDetail: { fontSize: 13, color: '#64748b', marginLeft: 6 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },

    // Existing Stats & Modules
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 25 },
    statCard: { alignItems: 'center', flex: 1 },
    iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    statLabel: { fontSize: 12, color: '#64748b' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 15 },
    modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
    moduleCard: { backgroundColor: '#fff', width: '47%', padding: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 10 },
    moduleIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    moduleTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
    moduleSub: { fontSize: 12, color: '#94a3b8' },

    // Bottom Nav
    bottomNav: { flexDirection: 'row', backgroundColor: '#fff', height: 80, position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 20, justifyContent: 'space-around', alignItems: 'center', paddingBottom: 20 },
    navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    navText: { fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: '500' },
    activeNavText: { color: '#2563eb', fontWeight: '700' },
    centerBtnWrapper: { top: -25, justifyContent: 'center', alignItems: 'center' },
    centerBtn: { shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10 },
    centerBtnGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },

    // Profile & Modal
    profileHeaderCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
    avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    avatarLargeText: { fontSize: 28, fontWeight: 'bold', color: '#1e40af' },
    profileName: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    profileRole: { fontSize: 14, color: '#64748b', marginTop: 2 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
    sectionHeader: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 15 },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBoxSmall: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#e2e8f0' },
    label: { fontSize: 12, color: '#64748b', marginBottom: 2 },
    value: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
    logoutButtonWrapper: { shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    logoutButtonGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, gap: 8 },
    logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    centerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    placeholderText: { marginTop: 20, color: '#94a3b8', fontSize: 16, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', elevation: 10 },
    modalIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    modalMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    modalActions: { flexDirection: 'row', width: '100%', gap: 12 },
    btnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#fff' },
    btnCancelText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    btnConfirmWrapper: { flex: 1 },
    btnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    // --- NEW ACTION BUTTON STYLES ---
    actionContainer: {
        marginTop: 5,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    btnReject: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fee2e2',
        gap: 6
    },
    btnRejectText: {
        color: '#ef4444',
        fontWeight: 'bold',
        fontSize: 14,
    },
    btnAccept: {
        flex: 1,
        borderRadius: 10,
        // Shadow for the main button
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    btnAcceptGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: '#16a34a',
    },
    btnAcceptText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});