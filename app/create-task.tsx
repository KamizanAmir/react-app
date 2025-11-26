import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Modal,
    FlatList,
    Dimensions,
    LogBox,
    useColorScheme
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import polyline from '@mapbox/polyline';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

const API_URL = 'http://192.168.49.90:8000/api';

// TYPES
interface User { id: number; name: string; no_tentera: string; }
interface Vehicle { asset_id: number; variant_id: number; registration_number: string; jenis_kenderaan: string; }
interface Passenger { name: string; army_number: string; }
interface Coords { latitude: number; longitude: number; }
interface SearchResult { display_name: string; lat: string; lon: string; }

// --- CUSTOM DROPDOWN (Updated with 'disabled' prop) ---
const CustomDropdown = ({ label, data, onSelect, placeholder, selectedVal, disabled }: any) => {
    const [visible, setVisible] = useState(false);
    return (
        <View style={styles.inputWrapper}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
                style={[styles.dropdownBox, disabled && styles.disabledInput]}
                onPress={() => !disabled && setVisible(true)}
                activeOpacity={disabled ? 1 : 0.7}
            >
                <Text style={[styles.inputText, !selectedVal && { color: '#94a3b8' }, disabled && { color: '#64748b' }]}>
                    {selectedVal || placeholder}
                </Text>
                {!disabled && <Ionicons name="chevron-down" size={20} color="#64748b" />}
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {label}</Text>
                            <TouchableOpacity onPress={() => setVisible(false)}><Ionicons name="close-circle" size={28} color="#ef4444" /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={data}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); setVisible(false); }}>
                                    <Text style={styles.modalItemText}>{item.name || item.registration_number || item}</Text>
                                    {item.no_tentera && <Text style={styles.modalSubText}>{item.no_tentera}</Text>}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// --- SEARCH COMPONENT (Updated with 'disabled' prop) ---
const NominatimSearch = ({ label, placeholder, onSelect, defaultValue, disabled }: any) => {
    const [query, setQuery] = useState(defaultValue || '');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showList, setShowList] = useState(false);

    // Update query if defaultValue changes (for view mode)
    useEffect(() => { if (defaultValue) setQuery(defaultValue); }, [defaultValue]);

    const searchLocation = async (text: string) => {
        setQuery(text);
        if (text.length < 3) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&addressdetails=1&limit=5`, { headers: { 'User-Agent': 'FMSMobileApp/1.0' } });
            const data = await res.json();
            setResults(data);
            setShowList(true);
        } catch (error) { console.log("Nominatim Error:", error); } finally { setSearching(false); }
    };

    return (
        <View style={[styles.inputWrapper, { zIndex: showList ? 100 : 1 }]}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputBox, disabled && styles.disabledInput]}>
                <Ionicons name="search" size={18} color={disabled ? "#94a3b8" : "#64748b"} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.textInput, disabled && { color: '#64748b' }]}
                    value={query}
                    onChangeText={searchLocation}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    editable={!disabled} // DISABLE EDITING
                />
                {searching && <ActivityIndicator size="small" color="#2563eb" />}
            </View>
            {showList && results.length > 0 && !disabled && (
                <View style={styles.searchResultsContainer}>
                    {results.map((item, index) => (
                        <TouchableOpacity key={index} style={styles.searchResultItem} onPress={() => {
                            setQuery(item.display_name); setShowList(false);
                            onSelect(item.display_name, parseFloat(item.lat), parseFloat(item.lon));
                        }}>
                            <Text style={styles.searchResultText} numberOfLines={2}>{item.display_name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

export default function CreateTaskScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mapRef = useRef<MapView>(null);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    // MODE CHECK: If 'taskId' exists, we are in VIEW MODE
    const taskId = params.taskId;
    const isReadOnly = !!taskId;

    // STATES
    const [loading, setLoading] = useState(true);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // DATA LISTS
    const [drivers, setDrivers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);

    // FORM FIELDS
    const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
    const [selectedDriver2, setSelectedDriver2] = useState<User | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [taskType, setTaskType] = useState<string>('');
    const [taskDate, setTaskDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [taskTime, setTaskTime] = useState<string>('08:00');
    const [taskDetails, setTaskDetails] = useState('');
    const [passengerList, setPassengerList] = useState<Passenger[]>([]);

    // MAP STATE
    const [fromText, setFromText] = useState('');
    const [toText, setToText] = useState('');
    const [fromCoords, setFromCoords] = useState<Coords | null>(null);
    const [toCoords, setToCoords] = useState<Coords | null>(null);
    const [routeCoords, setRouteCoords] = useState<Coords[]>([]);

    const TASK_TYPES = ['latihan', 'operasi', 'tadbir', 'Logistik', 'Pentadbiran', 'Lain-lain'];

    useEffect(() => {
        fetchFormData();
        if (isReadOnly) {
            fetchTaskDetails(taskId as string);
        }
    }, []);

    const fetchFormData = async () => {
        try {
            const response = await fetch(`${API_URL}/form-data`);
            const json = await response.json();
            if (json.status === 'success') {
                setDrivers(json.drivers);
                setAllUsers(json.users);
                setVehicles(json.vehicles);
            }
        } catch (error) { Alert.alert('Error', 'Could not fetch data'); } finally { setLoading(false); }
    };

    const fetchTaskDetails = async (id: string) => {
        setFetchingDetails(true);
        try {
            const response = await fetch(`${API_URL}/task/${id}`);
            const json = await response.json();
            if (json.status === 'success') {
                const data = json.data;
                // POPULATE FIELDS
                setSelectedDriver({ id: data.driver.id, name: data.driver.name, no_tentera: data.driver.no_tentera });
                if (data.driver2) setSelectedDriver2({ id: data.driver2.id, name: data.driver2.name, no_tentera: '' });
                setSelectedVehicle({ asset_id: data.vehicle.asset_id, variant_id: 0, registration_number: data.vehicle.registration_number, jenis_kenderaan: data.vehicle.jenis_kenderaan });

                setTaskType(data.task_type);
                setTaskDate(data.date);
                setTaskTime(data.time);
                setTaskDetails(data.description);
                setPassengerList(data.passengers);

                // MAP
                if (data.locations) {
                    setFromText(data.locations.start_location);
                    setToText(data.locations.end_location);
                    setFromCoords({ latitude: parseFloat(data.locations.start_lat), longitude: parseFloat(data.locations.start_lng) });
                    setToCoords({ latitude: parseFloat(data.locations.end_lat), longitude: parseFloat(data.locations.end_lng) });
                }
            }
        } catch (e) {
            Alert.alert("Error", "Could not load task details");
        } finally {
            setFetchingDetails(false);
        }
    }

    // --- MAP ROUTING ---
    useEffect(() => {
        if (fromCoords && toCoords) {
            fetchRoute();
            if (mapRef.current) {
                // Small timeout to ensure map is ready
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates([fromCoords, toCoords], {
                        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                        animated: true
                    });
                }, 500);
            }
        }
    }, [fromCoords, toCoords]);

    const fetchRoute = async () => {
        if (!fromCoords || !toCoords) return;
        try {
            const url = `http://router.project-osrm.org/route/v1/driving/${fromCoords.longitude},${fromCoords.latitude};${toCoords.longitude},${toCoords.latitude}?overview=full&geometries=polyline`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.routes && json.routes.length > 0) {
                const points = polyline.decode(json.routes[0].geometry);
                const coords = points.map((point: number[]) => ({ latitude: point[0], longitude: point[1] }));
                setRouteCoords(coords);
            }
        } catch (err) { console.log("Routing Error", err); }
    };

    const handleSubmit = async () => {
        // ... (Submit logic same as before) ...
        // You can keep this function, it won't be called in read-only mode
    };

    if (loading || fetchingDetails) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563eb" /></View>;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: isReadOnly ? 'Butiran Penugasan' : 'Cipta Penugasan' }} />

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='always'>

                {/* DRIVER */}
                <Text style={styles.sectionHeader}>MAKLUMAT PEMANDU</Text>
                <View style={styles.card}>
                    <CustomDropdown
                        label="Nama Pemandu" placeholder="Pilih" data={drivers}
                        selectedVal={selectedDriver?.name} onSelect={setSelectedDriver}
                        disabled={isReadOnly} // GREYED OUT
                    />
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>No. Tentera</Text>
                        <View style={[styles.inputBox, styles.disabledInput]}>
                            <Text style={[styles.inputText, { color: '#64748b' }]}>{selectedDriver?.no_tentera || '-'}</Text>
                        </View>
                    </View>
                    {/* Only show Driver 2 if selected or if not read only */}
                    {/* {(!isReadOnly || selectedDriver2) && (
                        <CustomDropdown
                            label="Pemandu Tambahan" placeholder="Tiada" data={drivers}
                            selectedVal={selectedDriver2?.name} onSelect={setSelectedDriver2}
                            disabled={isReadOnly}
                        />
                    )} */}
                </View>

                {/* VEHICLE */}
                <Text style={styles.sectionHeader}>MAKLUMAT KENDERAAN</Text>
                <View style={styles.card}>
                    <CustomDropdown
                        label="No. Daftar" placeholder="Pilih" data={vehicles}
                        selectedVal={selectedVehicle?.registration_number} onSelect={setSelectedVehicle}
                        disabled={isReadOnly}
                    />
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>Jenis Kenderaan</Text>
                        <View style={[styles.inputBox, styles.disabledInput]}>
                            <Text style={[styles.inputText, { color: '#64748b' }]}>{selectedVehicle?.jenis_kenderaan || '-'}</Text>
                        </View>
                    </View>
                </View>

                {/* TASK */}
                <Text style={styles.sectionHeader}>MAKLUMAT TUGAS</Text>
                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Tarikh</Text>
                            <View style={[styles.inputBox, isReadOnly && styles.disabledInput]}>
                                <TextInput style={[styles.textInput, isReadOnly && { color: '#64748b' }]} value={taskDate} onChangeText={setTaskDate} editable={!isReadOnly} />
                            </View>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Masa</Text>
                            <View style={[styles.inputBox, isReadOnly && styles.disabledInput]}>
                                <TextInput style={[styles.textInput, isReadOnly && { color: '#64748b' }]} value={taskTime} onChangeText={setTaskTime} editable={!isReadOnly} />
                            </View>
                        </View>
                    </View>
                    <View style={{ marginTop: 10 }}>
                        <CustomDropdown label="Jenis Tugas" placeholder="Pilih" data={TASK_TYPES} selectedVal={taskType} onSelect={setTaskType} disabled={isReadOnly} />
                    </View>
                    <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>Butiran</Text>
                        <View style={[styles.inputBox, isReadOnly && styles.disabledInput]}>
                            <TextInput style={[styles.textInput, isReadOnly && { color: '#64748b' }]} value={taskDetails} onChangeText={setTaskDetails} editable={!isReadOnly} />
                        </View>
                    </View>
                </View>

                {/* MAP */}
                <Text style={styles.sectionHeader}>LOKASI & PERGERAKAN</Text>
                <NominatimSearch
                    label="Lokasi Mula" placeholder="-" onSelect={() => { }}
                    defaultValue={fromText} disabled={isReadOnly}
                />
                <View style={{ marginTop: 10 }}>
                    <NominatimSearch
                        label="Lokasi Tamat" placeholder="-" onSelect={() => { }}
                        defaultValue={toText} disabled={isReadOnly}
                    />
                </View>

                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_DEFAULT}
                        style={styles.map}
                        initialRegion={{ latitude: 3.1412, longitude: 101.6865, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
                    >
                        <UrlTile urlTemplate={isDarkMode ? "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" : "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"} maximumZ={19} flipY={false} />
                        {fromCoords && <Marker coordinate={fromCoords} title="Start" pinColor={isDarkMode ? "teal" : "green"} />}
                        {toCoords && <Marker coordinate={toCoords} title="End" pinColor="red" />}
                        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor={isDarkMode ? "#60a5fa" : "#2563eb"} strokeWidth={4} />}
                    </MapView>
                </View>

                {/* PASSENGERS */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                    <Text style={styles.sectionHeader}>MAKLUMAT PENUMPANG</Text>
                    {/* Hide ADD Button if ReadOnly */}
                    {!isReadOnly && (
                        <TouchableOpacity onPress={() => setPassengerList([...passengerList, { name: '', army_number: '' }])}>
                            <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>+ Add</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {passengerList.length === 0 && isReadOnly && <Text style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tiada penumpang</Text>}
                {passengerList.map((p, i) => (
                    <View key={i} style={styles.card}>
                        {isReadOnly ? (
                            // View Mode: Simple Text
                            <View>
                                <Text style={{ fontSize: 12, color: '#64748b' }}>Nama</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 5 }}>{p.name}</Text>
                                <Text style={{ fontSize: 12, color: '#64748b' }}>No. Tentera</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>{p.army_number}</Text>
                            </View>
                        ) : (
                            // Edit Mode: Dropdown
                            <CustomDropdown label={`Penumpang ${i + 1}`} data={allUsers} selectedVal={p.name} onSelect={(u: User) => {
                                const list = [...passengerList]; list[i] = { name: u.name, army_number: u.no_tentera }; setPassengerList(list);
                            }} placeholder="Pilih Nama" />
                        )}
                    </View>
                ))}

                {/* SUBMIT BUTTON - HIDDEN IN VIEW MODE */}
                {!isReadOnly && (
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                        <LinearGradient colors={['#1e40af', '#3b82f6']} style={styles.gradientBtn}>
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Hantar Penugasan</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20 },
    sectionHeader: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 10, letterSpacing: 1 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, shadowColor: '#000', elevation: 2 },
    inputWrapper: { marginBottom: 10, position: 'relative' },
    label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 5 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, height: 45 },
    dropdownBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, height: 45 },
    inputText: { fontSize: 14, color: '#1e293b' },
    textInput: { flex: 1, fontSize: 14, color: '#1e293b', height: '100%' },
    disabledInput: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }, // GREYED OUT STYLE

    searchResultsContainer: { position: 'absolute', top: 65, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', elevation: 5, maxHeight: 150 },
    searchResultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    searchResultText: { fontSize: 13, color: '#334155' },
    mapContainer: { height: 250, borderRadius: 16, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    map: { width: '100%', height: '100%' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    modalTitle: { fontWeight: 'bold' },
    modalItem: { padding: 15, borderBottomWidth: 1, borderColor: '#f8fafc' },
    modalItemText: { fontSize: 15 },
    modalSubText: { fontSize: 12, color: '#94a3b8' },
    submitBtn: { marginTop: 20, shadowColor: '#2563eb', elevation: 4 },
    gradientBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold' }
});