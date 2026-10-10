import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  AppState,
  Image,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Base64 } from "js-base64";
import {
  api,
  restoreToken,
  saveToken,
  User,
  API_URL,
  onUnauthorized,
  clearPendingMutations,
  clearAllFormDrafts,
  flushPendingMutations,
  pendingMutationSummary,
} from "./src/api";
import { Button, Input, styles, colours } from "./src/ui";
import { Visits, People, Inbox, More } from "./src/screens";
import { AdminHome } from "./src/admin";
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
function newerVersion(latest:string,current:string){
  const next=latest.split(".").map(Number),installed=current.split(".").map(Number);
  return next.length===3&&installed.length===3&&next.every(Number.isSafeInteger)&&installed.every(Number.isSafeInteger)&&
    next.some((value,index)=>value!==installed[index]&&next.slice(0,index).every((prior,position)=>prior===installed[position])&&value>installed[index]);
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [email, setEmail] = useState(""),
    [link, setLink] = useState(""),
    [tab, setTab] = useState("Visits"),
    [menuOpen, setMenuOpen] = useState(false),
    [moreDestination, setMoreDestination] = useState({ section: "", request: 0 }),
    [requestedVisitId, setRequestedVisitId] = useState<string | null>(null),
    [deviceLock, setDeviceLock] = useState(false),
    [pushEnabled, setPushEnabled] = useState(false),
    [locked, setLocked] = useState(false),
    [lockError, setLockError] = useState("");
  const exchanging = useRef(false);
  const lastActivity = useRef(Date.now()), endingSession = useRef(false);
  const authenticating = useRef(false);
  const wasBackgrounded = useRef(false);
  const updatePromptedFor=useRef("");
  async function checkPublishedUpdate(){
    if(Platform.OS!=="android"&&Platform.OS!=="ios")return;
    try{
      const response=await api<{latestPublishedVersion:string}>("/api/mobile/version");
      const latest=response.latestPublishedVersion,current=Constants.expoConfig?.version||"";
      if(!newerVersion(latest,current)||updatePromptedFor.current===latest)return;
      updatePromptedFor.current=latest;
      Alert.alert("Caremonitor update available",`Version ${latest} is available. Update through your app store for the latest care features.`,[
        {text:"Later",style:"cancel"},
        {text:"Update",onPress:()=>void Linking.openURL(Platform.OS==="ios"?"https://apps.apple.com/app/id6816475264":"https://play.google.com/store/apps/details?id=com.aniprotech.care")},
      ]);
    }catch{/* The app remains usable if the version service is unavailable. */}
  }
  const markActivity = () => { lastActivity.current = Date.now(); };
  const lockKey = (id: string) => `caremonitor-device-lock-${id}`;
  const pushKey = (id: string) => `caremonitor-push-token-${id}`;
  async function restorePush(userId:string) {
    if (Platform.OS === "web") return false;
    const token=await SecureStore.getItemAsync(pushKey(userId));
    if (!token) return false;
    try { await api("/api/mobile/push-token","PUT",{token,platform:Platform.OS});return true; }
    catch { return false; }
  }
  async function changePush(enabled:boolean) {
    if (!user) return;
    if (!enabled) {
      const token=await SecureStore.getItemAsync(pushKey(user.id));
      if (token) await api("/api/mobile/push-token","DELETE",{token});
      await SecureStore.deleteItemAsync(pushKey(user.id));
      setPushEnabled(false);
      return;
    }
    if (Platform.OS==="android") await Notifications.setNotificationChannelAsync("caremonitor-updates",{name:"Caremonitor updates",importance:Notifications.AndroidImportance.HIGH});
    let permission=await Notifications.getPermissionsAsync();
    if (!permission.granted) permission=await Notifications.requestPermissionsAsync();
    if (!permission.granted) throw new Error("Allow notifications in your phone settings to receive rota and team updates.");
    const projectId=Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error("Notification project configuration is missing.");
    const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
    await api("/api/mobile/push-token","PUT",{token,platform:Platform.OS});
    await SecureStore.setItemAsync(pushKey(user.id),token);
    setPushEnabled(true);
  }
  async function unlockDevice() {
    if (authenticating.current) return;
    authenticating.current = true;
    setLockError("");
    try {
      const result = await LocalAuthentication.authenticateAsync({promptMessage:"Unlock Caremonitor",cancelLabel:"Cancel",disableDeviceFallback:false});
      if (result.success) { setLocked(false); markActivity(); }
      else setLockError("Device authentication was not completed. Try again or sign out.");
    } catch {
      setLockError("Device authentication is unavailable. Try again or sign out.");
    } finally { authenticating.current = false; }
  }
  async function changeDeviceLock(enabled: boolean) {
    if (!user || authenticating.current) return;
    authenticating.current = true;
    wasBackgrounded.current = false;
    try {
      if (enabled && (!await LocalAuthentication.hasHardwareAsync() || !await LocalAuthentication.isEnrolledAsync()))
        throw new Error("Set up Face ID, Touch ID or fingerprint in your device settings first.");
      const result=await LocalAuthentication.authenticateAsync({promptMessage:enabled?"Enable Caremonitor device lock":"Disable Caremonitor device lock",disableDeviceFallback:false});
      if (!result.success) throw new Error("Device authentication was not completed.");
      if (enabled) await SecureStore.setItemAsync(lockKey(user.id),"enabled");
      else await SecureStore.deleteItemAsync(lockKey(user.id));
      setDeviceLock(enabled);
      setLocked(false);
    } finally {
      wasBackgrounded.current = false;
      authenticating.current = false;
    }
  }
  async function signIn(url: string) {
    if (exchanging.current) return;
    exchanging.current = true;
    setBusy(true);
    setError("");
    try {
      const token = new URL(url.trim()).searchParams.get("token");
      if (!token)
        throw new Error("Paste the complete sign-in link from your email.");
      const decoded = Base64.decode(token),
        separator = decoded.indexOf(":");
      if (separator < 1) throw new Error("Invalid sign-in link");
      const result = await api<{ user: User; accessToken: string }>(
        "/api/auth/get-token",
        "POST",
        {
          email: decoded.slice(0, separator),
          password: decoded.slice(separator + 1),
        },
      );
      await saveToken(result.accessToken);
      setDeviceLock(Platform.OS !== "web" && (await SecureStore.getItemAsync(lockKey(result.user.id))) === "enabled");
      setPushEnabled(await restorePush(result.user.id));
      setLocked(false);
      setUser(result.user);
      setTab(result.user.role === "CAREGIVER" ? "Visits" : "Admin");
      setLink("");
      setInfo("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      exchanging.current = false;
    }
  }
  useEffect(() => {
    void checkPublishedUpdate();
    onUnauthorized(() => {
      void saveToken(null);
      setUser(null);
      setError("Your session expired. Please sign in again.");
    });
    let active = true;
    const startupTimeout = setTimeout(() => {
      if (!active) return;
      void saveToken(null);
      setUser(null);
      setReady(true);
      setError("A previous session could not be restored. Please sign in again.");
    }, 6000);
    (async () => {
      try {
        if (await restoreToken()) {
          const result = await api<{ user: User; token?: string }>(
            "/api/auth/validate-token",
            "POST",
          );
          if (result.token) await saveToken(result.token);
          if (active) {
            const enabled=Platform.OS !== "web" && (await SecureStore.getItemAsync(lockKey(result.user.id))) === "enabled";
            setDeviceLock(enabled);
            setPushEnabled(false);
            void restorePush(result.user.id).then((enabled)=>{if(active)setPushEnabled(enabled)});
            setLocked(enabled);
            setUser(result.user);
            setTab(result.user.role === "CAREGIVER" ? "Visits" : "Admin");
          }
        }
        const initial = await Linking.getInitialURL();
        if (initial && new URL(initial).searchParams.has("token"))
          await signIn(initial);
      } catch {
        await saveToken(null);
      } finally {
        clearTimeout(startupTimeout);
        if (active) setReady(true);
      }
    })();
    const sub = Linking.addEventListener("url", (e) => {
      if (e.url.includes("token=")) void signIn(e.url);
    });
    return () => {
      active = false;
      clearTimeout(startupTimeout);
      sub.remove();
    };
  }, []);
  async function finishLogout(message = "", clearOfflineRecords = false) {
    if (endingSession.current) return;
    endingSession.current = true;
    setBusy(true);
    try {
      if(user && Platform.OS !== "web"){
        try {const token=await SecureStore.getItemAsync(pushKey(user.id));if(token)await api("/api/mobile/push-token","DELETE",{token});}
        catch { /* Revoking the login session also stops server-side notification delivery. */ }
        await SecureStore.deleteItemAsync(pushKey(user.id)).catch(()=>{});
      }
      await api("/api/auth/logout", "POST");
    } catch {
    } finally {
      await saveToken(null);
      if (clearOfflineRecords && user) {
        await clearPendingMutations(user.id);
        await clearAllFormDrafts();
      }
      setUser(null);
      setLocked(false);
      setDeviceLock(false);
      setPushEnabled(false);
      setTab("Visits");
      setError(message);
      setBusy(false);
      endingSession.current = false;
    }
  }
  async function logout() {
    if (user) {
      try {
        let pending = await pendingMutationSummary(user.id);
        if (pending.pending) {
          await flushPendingMutations(user.id);
          pending = await pendingMutationSummary(user.id);
        }
        if (pending.pending) {
          Alert.alert(
            "Care records have not synced",
            `${pending.pending} record${pending.pending === 1 ? "" : "s"} remain only on this device. Signing out will discard them. Connect to the internet and synchronise before signing out.`,
            [
              { text: "Stay signed in", style: "cancel" },
              { text: "Discard and sign out", style: "destructive", onPress: () => void finishLogout("", true) },
            ],
          );
          return;
        }
      } catch (error) {
        Alert.alert("Cannot verify care records", `${(error as Error).message} Stay signed in and contact your administrator before signing out.`);
        return;
      }
    }
    await finishLogout("", true);
  }
  useEffect(() => {
    if (!user) return;
    markActivity();
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        await flushPendingMutations(user.id);
      } catch {
        // The offline queue remains available for the next reconnect or manual sync.
      } finally {
        syncing = false;
      }
    };
    void sync();
    const refresh = async () => {
      try {
        const result = await api<{ token?: string }>("/api/auth/validate-token", "POST");
        if (result.token) await saveToken(result.token);
        await sync();
        // Keep credentials and queued records current without remounting the
        // active screen: a remount can discard data someone is entering.
      } catch {
        await finishLogout("Your session is no longer available. Please sign in again.");
      }
    };
    const heartbeat = setInterval(() => { void refresh(); }, 10 * 60 * 1000);
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        if (authenticating.current) return;
        wasBackgrounded.current = true;
        if (deviceLock) setLocked(true);
        return;
      }
      if (next === "inactive") return;
      if (next === "active") {
        lastActivity.current = 0;
        void checkPublishedUpdate();
        if (wasBackgrounded.current && deviceLock && !authenticating.current) void unlockDevice();
        wasBackgrounded.current = false;
        void refresh();
      }
    });
    return () => { clearInterval(heartbeat); appState.remove(); };
  }, [user,deviceLock]);
  async function requestLink() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/request-link", "POST", {
        email: email.trim().toLowerCase(),
        client: "mobile",
      });
      setInfo(
        "Check your email. Open the newest link, or paste it below. It works once and expires in 15 minutes.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tabs =
    user?.role === "CAREGIVER"
      ? ["Visits", "Clients", "Inbox", "More"]
      : ["Admin", "Visits", "Clients", "Team", "Inbox", "More"];
  const menuItems: { label: string; tab?: string; section?: string }[] = user?.role === "CAREGIVER"
    ? [
        { label: "My visits / rota", tab: "Visits" },
        { label: "Clients", tab: "Clients" },
        { label: "Inbox", tab: "Inbox" },
        { label: "Care alerts", section: "Notifications" },
        { label: "My timesheet", section: "Timesheet" },
        { label: "My availability", section: "Availability" },
        { label: "Time off requests", section: "Time off" },
        { label: "My account", tab: "More" },
      ]
    : [
        { label: "Admin workspace", tab: "Admin" },
        { label: "Visits / rota", tab: "Visits" },
        { label: "Clients", tab: "Clients" },
        { label: "Team", tab: "Team" },
        { label: "Inbox", tab: "Inbox" },
        { label: "Care alerts", section: "Notifications" },
        { label: "Reporting", section: "Reporting" },
        { label: "Invoices", section: "Invoices" },
        { label: "Staff pay", section: "Staff pay" },
        { label: "Accounting", section: "Accounting" },
        { label: "Organisation settings", section: "Organisation settings" },
        { label: "Activity log", section: "Log" },
        { label: "Governance", section: "Governance" },
        { label: "Leave requests", section: "Leave requests" },
        { label: "Availability requests", section: "Availability requests" },
        { label: "Travel claims", section: "Travel claims" },
        ...(user?.role === "SUPERADMIN" ? [{ label: "Platform organisations", section: "Platform" }] : []),
        { label: "My account", tab: "More" },
      ];
  function selectMenuItem(item: { tab?: string; section?: string }) {
    setMenuOpen(false);
    if (item.section) {
      setMoreDestination((current) => ({ section: item.section!, request: current.request + 1 }));
      setTab("More");
    } else if (item.tab) {
      if (item.tab === "More") setMoreDestination((current) => ({ section: "", request: current.request + 1 }));
      setTab(item.tab);
    }
  }
  return (
    <SafeAreaProvider>
      <SafeAreaView onTouchStart={markActivity} style={{ flex: 1, backgroundColor: colours.background }}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {!ready ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colours.navy, gap: 24 }}>
              <Image source={require("./assets/icon.png")} resizeMode="contain" style={{ width: 136, height: 136, borderRadius: 30 }} accessibilityLabel="AniProTech" />
              <ActivityIndicator color={colours.cyanBright} />
            </View>
          ) : !user ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.page, { paddingTop: 60 }]}
            >
              <Image source={require("./assets/brand-logo.png")} resizeMode="contain" style={{ width: "100%", height: 120, borderRadius: 16 }} accessibilityLabel="AniProTech" />
              <Text style={[styles.badge, { letterSpacing: 2 }]}>CAREMONITOR</Text>
              <Text style={styles.title}>Care, connected.</Text>
              <Text style={styles.muted}>
                Sign in to view your visits and stay in touch with your team.
              </Text>
              {!!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              {!!info && <Text style={styles.text}>{info}</Text>}
              <Input
                label="Email address"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <Button
                title={busy ? "Please wait..." : "Send sign-in link"}
                disabled={busy || !email.trim()}
                onPress={() => void requestLink()}
              />
              <View style={{ height: 12 }} />
              <Input
                label="Or paste your email sign-in link"
                autoCapitalize="none"
                autoCorrect={false}
                value={link}
                onChangeText={setLink}
              />
              <Button
                title="Continue with link"
                disabled={busy || !link.trim()}
                onPress={() => void signIn(link)}
              />
              {__DEV__ && (
                <Text style={styles.muted}>Development server: {API_URL}</Text>
              )}
            </ScrollView>
          ) : locked ? (
            <View style={[styles.page,{flex:1,justifyContent:"center",gap:16}]}>
              <Image source={require("./assets/icon.png")} resizeMode="contain" style={{width:90,height:90,alignSelf:"center"}} accessibilityLabel="Caremonitor" />
              <Text style={styles.title}>Caremonitor is locked</Text>
              <Text style={styles.muted}>Confirm your device identity to view care information.</Text>
              {!!lockError&&<Text accessibilityRole="alert" style={styles.error}>{lockError}</Text>}
              <Button title="Unlock" onPress={()=>void unlockDevice()}/>
              <Button variant="secondary" title="Sign out" onPress={()=>void logout()}/>
            </View>
          ) : (
            <>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: "white",
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: "#D8EAF3",
                }}
              >
                <Image source={require("./assets/icon.png")} resizeMode="contain" style={{ width: 48, height: 48, borderRadius: 10 }} accessibilityLabel="Caremonitor icon" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colours.navy, fontSize: 20, fontWeight: "800" }}>Caremonitor</Text>
                  <Text style={{ color: "#526986", fontSize: 12 }}>Secure care delivery</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open navigation menu"
                  accessibilityHint="Shows the features available to your account"
                  onPress={() => setMenuOpen(true)}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: "#B9D5E3",
                    backgroundColor: "white",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  {[0, 1, 2].map((line) => <View key={line} style={{ width: 21, height: 2, borderRadius: 2, backgroundColor: colours.navy }} />)}
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                {tab === "Admin" && user.role !== "CAREGIVER" ? (
                  <AdminHome user={user} navigate={setTab} />
                ) : tab === "Visits" ? (
                  <Visits user={user} requestedVisitId={requestedVisitId} onVisitOpened={() => setRequestedVisitId(null)} />
                ) : tab === "Clients" ? (
                  <People kind="clients" user={user} onOpenVisit={(id) => { setRequestedVisitId(id); setTab("Visits"); }} />
                ) : tab === "Team" ? (
                  <People kind="team" user={user} />
                ) : tab === "Inbox" ? (
                  <Inbox user={user} />
                ) : (
                  <More key={moreDestination.request} initialSection={moreDestination.section} user={user} logout={() => void logout()} onProfileUpdated={(changes)=>setUser((current)=>current?{...current,...changes}:current)} deviceLock={deviceLock} changeDeviceLock={changeDeviceLock} pushEnabled={pushEnabled} changePush={changePush} />
                )}
              </View>
              <View style={styles.tabs}>
                {tabs.map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === t }}
                    onPress={() => t === "More" ? selectMenuItem({ tab: "More" }) : setTab(t)}
                    style={styles.tab}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        tab === t && { color: colours.cyan, fontWeight: "700" },
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
                <View style={{ flex: 1, flexDirection: "row", backgroundColor: "rgba(4, 25, 49, 0.55)" }}>
                  <SafeAreaView style={{ width: "84%", maxWidth: 360, backgroundColor: "white" }}>
                    <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#D8EAF3", flexDirection: "row", alignItems: "center" }}>
                      <Image source={require("./assets/icon.png")} style={{ width: 42, height: 42, borderRadius: 9 }} accessibilityLabel="Caremonitor icon" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: colours.navy }}>Caremonitor</Text>
                        <Text style={{ fontSize: 12, color: "#526986" }}>{user.role === "CAREGIVER" ? "Caregiver menu" : "Admin menu"}</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={() => setMenuOpen(false)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 25, color: colours.navy }}>×</Text>
                      </Pressable>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
                      <Text style={{ color: "#526986", fontSize: 12, marginHorizontal: 10, marginBottom: 8 }}>{user.firstName} {user.lastName} · {user.role === "CAREGIVER" ? "Caregiver" : user.role === "SUPERADMIN" ? "Super admin" : "Admin"}</Text>
                      {menuItems.map((item) => (
                        <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => selectMenuItem(item)} style={({ pressed }) => ({ minHeight: 46, justifyContent: "center", paddingHorizontal: 12, borderRadius: 9, backgroundColor: (item.tab === tab && !item.section) ? "#E8F7FC" : pressed ? "#F1F7FA" : "white" })}>
                          <Text style={{ color: colours.navy, fontSize: 15, fontWeight: (item.tab === tab && !item.section) ? "700" : "500" }}>{item.label}</Text>
                        </Pressable>
                      ))}
                      {user.role === "CAREGIVER" && <Text style={{ color: "#526986", fontSize: 12, lineHeight: 18, marginHorizontal: 12, marginTop: 12 }}>Open a visit for care plans, risks, tasks, medication, notes, observations, concerns and photos.</Text>}
                      <Pressable accessibilityRole="button" accessibilityLabel="Sign out of Caremonitor" disabled={busy} onPress={() => { setMenuOpen(false); void logout(); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 12, marginTop: 16, borderTopWidth: 1, borderTopColor: "#D8EAF3" }}>
                        <Text style={{ color: colours.navy, fontSize: 15, fontWeight: "700" }}>Sign out</Text>
                      </Pressable>
                    </ScrollView>
                  </SafeAreaView>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={() => setMenuOpen(false)} style={{ flex: 1 }} />
                </View>
              </Modal>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
