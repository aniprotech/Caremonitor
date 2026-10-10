import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  Alert,
  Pressable,
  Linking,
  Image,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { CameraView, useCameraPermissions } from "expo-camera";
import { API_URL, api, apiOrQueue, clearFormDraft, clientEventId, flushPendingMutations, pendingMutationSummary, restoreFormDraft, saveFormDraft, uploadOrQueuePhoto, User, SyncSummary } from "./api";
import { CarePlanManager, PrnLimitsManager, TaskPlanManager } from "./admin";
import { MedicationBodyMap, SkinBodyMap } from "./bodyMap";
import { AccountingManager, FinanceManager } from "./operations";
import { OrganisationSettings } from "./organisation";
import { DateInput, TimeInput } from "./pickers";
import { ClinicalProfileEditor } from "./clinical";
import {
  Button,
  Input,
  Card,
  styles,
  today,
  addDays,
  currency,
  timestamp,
} from "./ui";
type Row = Record<string, any>;
function useData<T>(path: string, method = "GET", body?: unknown) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tick, setTick] = useState(0);
  const encoded = JSON.stringify(body);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path, method, encoded ? JSON.parse(encoded) : undefined)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, method, encoded, tick]);
  return { data, error, loading, refresh: () => setTick((n) => n + 1) };
}
function ErrorText({ error }: { error: string }) {
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {error}
    </Text>
  ) : null;
}
function Empty({ text }: { text: string }) {
  return (
    <Card>
      <Text style={styles.muted}>{text}</Text>
    </Card>
  );
}
function bodyMapText(value: unknown) {
  if (typeof value !== "string" || !value.trim() || ["{}", "[]", "null"].includes(value.trim())) return "";
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") return parsed.trim();
    if (parsed && typeof parsed === "object") return [parsed.area, parsed.site, parsed.side, parsed.instructions, parsed.notes].filter((part) => typeof part === "string" && part.trim()).join(" · ") || value.trim();
  } catch { return value.trim(); }
  return "";
}
function prnConfigured(medication: Row) {
  return Number.isSafeInteger(Number(medication.timeBetweenDoses))&&Number(medication.timeBetweenDoses)>0&&
    ["minutes","hours","days"].includes(String(medication.timeBetweenUnit||"").toLowerCase())&&
    Number.isSafeInteger(Number(medication.maxDoseCount))&&Number(medication.maxDoseCount)>0&&
    Number.isSafeInteger(Number(medication.maxDosePeriod))&&Number(medication.maxDosePeriod)>0&&
    ["minutes","hours","days","weeks"].includes(String(medication.maxDoseUnit||"").toLowerCase());
}
const clinicalUnits: Record<string,string> = {"Blood pressure":"mmHg","Blood glucose":"mmol/L",Weight:"kg",Temperature:"°C",Pulse:"bpm","Oxygen saturation":"%"};
function validClinicalValue(type:string,value:string) {
  const text=value.trim();
  if(type==="Other")return text.length>=2;
  if(type==="Blood pressure")return /^\d{2,3}\s*\/\s*\d{2,3}$/.test(text);
  return /^\d{1,4}(?:\.\d{1,2})?$/.test(text);
}
function visitDuration(start:string,end:string) {
  const a=start.split(":").map(Number),b=end.split(":").map(Number);
  const minutes=b[0]*60+b[1]-a[0]*60-a[1];
  return Number.isFinite(minutes)&&minutes>0?`${minutes} min`:"";
}
const repeatDays = [
  ["MON", "MONDAY"], ["TUE", "TUESDAY"], ["WED", "WEDNESDAY"], ["THU", "THURSDAY"],
  ["FRI", "FRIDAY"], ["SAT", "SATURDAY"], ["SUN", "SUNDAY"],
] as const;
export function Visits({user,requestedVisitId,onVisitOpened}:{user:User;requestedVisitId?:string|null;onVisitOpened?:()=>void}) {
  const [date, setDate] = useState(today),
    [selected, setSelected] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Row | null>(null),
    [note, setNote] = useState(""),
    [observationType,setObservationType]=useState("Wellbeing"),
    [observation,setObservation]=useState(""),
    [incident, setIncident] = useState(""),
    [incidentCategory, setIncidentCategory] = useState("Health deterioration"),
    [caption, setCaption] = useState(""),
    [listening, setListening] = useState<"note"|"incident"|null>(null),
    [creating,setCreating]=useState(false),
    [editingVisit,setEditingVisit]=useState<Row|null>(null),
    [clientId,setClientId]=useState(""),
    [staffId,setStaffId]=useState(""),
    [startTime,setStartTime]=useState("09:00"),
    [endTime,setEndTime]=useState("10:00"),
    [visitTitle,setVisitTitle]=useState("Care visit"),
    [visitNotes,setVisitNotes]=useState(""),
    [visitFrequency,setVisitFrequency]=useState<"DAILY"|"WEEKLY"|"CUSTOM">("WEEKLY"),
    [repeatEvery,setRepeatEvery]=useState("1"),
    [repeatUnit,setRepeatUnit]=useState<"DAYS"|"WEEKS">("WEEKS"),
    [selectedDays,setSelectedDays]=useState<string[]>([]),
    [visitEndDate,setVisitEndDate]=useState(""),
    [visitFormError,setVisitFormError]=useState(""),
    [selectedMedication,setSelectedMedication]=useState<Row|null>(null),
    [medicationOutcome,setMedicationOutcome]=useState("ADMINISTERED"),
    [medicationSlot,setMedicationSlot]=useState(""),
    [medicationReason,setMedicationReason]=useState(""),
    [medicationNote,setMedicationNote]=useState(""),
    [medicationQuantity,setMedicationQuantity]=useState("1"),
    [medicationWitness,setMedicationWitness]=useState(""),
    [medicationAllergyAcknowledged,setMedicationAllergyAcknowledged]=useState(false),
    [medicationBodyMapAcknowledged,setMedicationBodyMapAcknowledged]=useState(false),
    [clinicalType,setClinicalType]=useState("Blood pressure"),
    [clinicalValue,setClinicalValue]=useState(""),
    [skinView,setSkinView]=useState("Front"),
    [skinSide,setSkinSide]=useState("Left"),
    [skinRegion,setSkinRegion]=useState(""),
    [skinConcern,setSkinConcern]=useState(""),
    [incompleteTask,setIncompleteTask]=useState<Row|null>(null),
    [taskReason,setTaskReason]=useState(""),
    [tracking,setTracking]=useState(false),
    [arrivalWatching,setArrivalWatching]=useState(false),
    [arrivalMessage,setArrivalMessage]=useState(""),
    [locationExceptionReason,setLocationExceptionReason]=useState(""),
    [qrCode,setQrCode]=useState(""),
    [qrUnavailable,setQrUnavailable]=useState(false),
    [qrUnavailableReason,setQrUnavailableReason]=useState(""),
    [scanningQr,setScanningQr]=useState(false),
    [lastLocationAt,setLastLocationAt]=useState<string|null>(null),
    [clock,setClock]=useState(Date.now()),
    [syncSummary,setSyncSummary]=useState<SyncSummary>({pending:0,blocked:0,sent:0,lastSyncAt:null,items:[]});
  const locationSubscription=useRef<Location.LocationSubscription|null>(null);
  const visitDraftReady=useRef(false);
  const qrScanHandled=useRef(false);
  const [cameraPermission,requestCameraPermission]=useCameraPermissions();
  const arrivalSubscription=useRef<Location.LocationSubscription|null>(null);
  const arrivalStartVisit=useRef<string|null>(null);
  const arrivalGeneration=useRef(0);
  const { data, error, loading, refresh } = useData<{ visits: Row[] }>(
    `/api/roster/visits?from=${date}&to=${date}`,
  );
  const week=useData<{visits:Row[]}>(`/api/roster/visits?from=${today()}&to=${addDays(today(),6)}`);
  const openShifts=useData<{visits:Row[]}>(`/api/roster/open-shifts?from=${date}&to=${date}`);
  const options=useData<{canManage:boolean;clients:Row[];staff:Row[]}>("/api/roster/options");
  const visitDraftScope=`visit-${user.id}`;
  useEffect(()=>{
    let active=true;
    if(user.role==="CAREGIVER"){visitDraftReady.current=true;return;}
    void restoreFormDraft<Row>(visitDraftScope).then(draft=>{
      if(!active||!draft||draft.version!==1)return;
      setClientId(String(draft.clientId||""));setStaffId(String(draft.staffId||""));setDate(String(draft.date||today()));
      setStartTime(String(draft.startTime||"09:00"));setEndTime(String(draft.endTime||"10:00"));setVisitTitle(String(draft.visitTitle||"Care visit"));setVisitNotes(String(draft.visitNotes||""));
      setVisitFrequency(["DAILY","WEEKLY","CUSTOM"].includes(draft.visitFrequency)?draft.visitFrequency:"WEEKLY");
      setRepeatEvery(String(draft.repeatEvery||"1"));setRepeatUnit(draft.repeatUnit==="DAYS"?"DAYS":"WEEKS");
      setSelectedDays(Array.isArray(draft.selectedDays)?draft.selectedDays.filter((day:unknown)=>typeof day==="string"):[]);setVisitEndDate(String(draft.visitEndDate||""));setCreating(true);
      Alert.alert("Visit draft restored","Your unfinished visit schedule was restored on this device. Review it and save when ready.");
    }).finally(()=>{visitDraftReady.current=true;});
    return()=>{active=false};
  },[user.id,user.role,visitDraftScope]);
  useEffect(()=>{
    if(user.role==="CAREGIVER"||!creating||!!editingVisit||!visitDraftReady.current)return;
    const draft={version:1,clientId,staffId,date,startTime,endTime,visitTitle,visitNotes,visitFrequency,repeatEvery,repeatUnit,selectedDays,visitEndDate};
    const timer=setTimeout(()=>{void saveFormDraft(visitDraftScope,draft).catch(()=>{});},700);
    return()=>clearTimeout(timer);
  },[user.role,creating,editingVisit,clientId,staffId,date,startTime,endTime,visitTitle,visitNotes,visitFrequency,repeatEvery,repeatUnit,selectedDays,visitEndDate,visitDraftScope]);
  useEffect(()=>{
    if(!requestedVisitId)return;
    let active=true;
    setQrCode("");
    setQrUnavailable(false);
    setQrUnavailableReason("");
    setScanningQr(false);
    setBusy(true);
    void api<Row>(`/api/mobile/visits/${requestedVisitId}`).then(result=>{
      if(!active)return;
      setDate(result.visit.date);
      setSelected(result.visit);
      setDetail(result);
      onVisitOpened?.();
    }).catch(e=>Alert.alert("Visit unavailable",(e as Error).message)).finally(()=>{if(active)setBusy(false)});
    return()=>{active=false};
  },[requestedVisitId,user.id]);
  useEffect(()=>{void pendingMutationSummary(user.id).then(setSyncSummary)},[user.id]);
  useEffect(()=>()=>{locationSubscription.current?.remove();locationSubscription.current=null;arrivalSubscription.current?.remove();arrivalSubscription.current=null},[]);
  useEffect(()=>{if(detail?.visit?.status!=="IN_PROGRESS")return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[detail?.visit?.status]);
  useEffect(()=>{
    if(user.role!=="CAREGIVER"||!selected?.id||detail?.visit?.id!==selected.id||detail?.visit?.status!=="SCHEDULED"||detail?.visit?.date!==today())return;
    void startArrivalWatching(selected.id).catch(error=>setArrivalMessage((error as Error).message));
    return()=>stopArrivalWatching();
  },[user.role,selected?.id,detail?.visit?.id,detail?.visit?.status,detail?.visit?.date]);
  async function stopLocationTracking(){locationSubscription.current?.remove();locationSubscription.current=null;setTracking(false)}
  function stopArrivalWatching(){arrivalGeneration.current++;arrivalSubscription.current?.remove();arrivalSubscription.current=null;arrivalStartVisit.current=null;setArrivalWatching(false)}
  async function startArrivalWatching(visitId:string){
    if(arrivalSubscription.current||arrivalStartVisit.current===visitId)return;
    arrivalStartVisit.current=visitId;
    const generation=arrivalGeneration.current;
    try{
    if(!(await Location.hasServicesEnabledAsync()))throw new Error("Turn on location services for arrival alerts.");
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=="granted")throw new Error("Allow location while using the app for arrival alerts.");
    if(generation!==arrivalGeneration.current)return;
    const subscription=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:30000,distanceInterval:20},position=>{
      if(position.coords.accuracy==null)return;
      void api<{notified:boolean;distanceMetres:number|null}>(`/api/mobile/visits/${visitId}/proximity`,"POST",{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy}).then(result=>{
        if(result.notified){setArrivalMessage("Arrival recorded and administrators notified.");stopArrivalWatching()}
      }).catch(()=>setArrivalMessage("Arrival alert could not be sent. Check your connection."));
    });
    if(generation!==arrivalGeneration.current){subscription.remove();return}
    arrivalSubscription.current=subscription;
    setArrivalWatching(true);
    setArrivalMessage("Watching for arrival while Caremonitor is open.");
    }catch(error){arrivalStartVisit.current=null;throw error}
  }
  async function startLocationTracking(visitId:string){
    if(locationSubscription.current)return;
    if(!(await Location.hasServicesEnabledAsync()))throw new Error("Turn on location services to track this active visit.");
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=="granted")throw new Error("Location permission is required while the visit is active.");
    locationSubscription.current=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:60000,distanceInterval:25},position=>{
      const recordedAt=new Date(position.timestamp).toISOString();setLastLocationAt(recordedAt);
      void apiOrQueue(`/api/mobile/visits/${visitId}/locations`,{clientEventId:clientEventId(),latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,recordedAt},user.id,"Active visit location").then(()=>pendingMutationSummary(user.id).then(setSyncSummary)).catch(()=>pendingMutationSummary(user.id).then(setSyncSummary));
    });
    setTracking(true);
  }
  async function synchroniseNow(){setBusy(true);try{const result=await flushPendingMutations(user.id);setSyncSummary(await pendingMutationSummary(user.id));if(!result.pending)Alert.alert("Synchronisation complete",`${result.sent} pending visit record${result.sent===1?"":"s"} sent successfully.`);else Alert.alert("Synchronisation needs attention",`${result.pending} record${result.pending===1?"":"s"} remain on this device. Review the reason below and resolve it before completing care records.`);}catch(e){Alert.alert("Synchronisation unavailable",(e as Error).message)}finally{setBusy(false)}}
  async function saveVisit(){
    setBusy(true);
    setVisitFormError("");
    try{
      if(!editingVisit&&visitEndDate&&visitEndDate<date)throw new Error("The optional end date must be on or after the visit date.");
      const payload={clientId,staffId:staffId||null,date,startTime,endTime,title:visitTitle,notes:visitNotes,status:staffId?"SCHEDULED":"DRAFT",repeatWeeks:1,requiredStaff:editingVisit?.requiredStaff||1,openShift:editingVisit?.openShift||false,...(!editingVisit?{frequency:visitFrequency,repeatEvery:Math.max(1,Math.min(12,Number(repeatEvery)||1)),repeatUnit,selectedDays:visitFrequency==="DAILY"?[]:selectedDays,endDate:visitEndDate||null}:{}),...(editingVisit?{revision:editingVisit.revision}:{})};
      if(editingVisit){
        const updated=await api<Row>(`/api/roster/visits/${editingVisit.id}`,"PUT",payload);
        setSelected(updated);setDetail(await api(`/api/mobile/visits/${updated.id}`));
      }else await api("/api/roster/visits","POST",payload);
      await clearFormDraft(visitDraftScope);
      setCreating(false);setEditingVisit(null);setClientId("");setStaffId("");setVisitNotes("");setVisitFrequency("WEEKLY");setRepeatEvery("1");setRepeatUnit("WEEKS");setSelectedDays([]);setVisitEndDate("");refresh();
      Alert.alert(editingVisit?"Visit updated":"Visit created","The assignment is saved in the web roster and will appear on the caregiver's mobile schedule.");
    }catch(e){
      setVisitFormError((e as Error).message);
      if(Platform.OS!=="web")Alert.alert("Visit could not be saved",(e as Error).message);
    }finally{setBusy(false)}
  }
  function editVisit(visit:Row){
    void clearFormDraft(visitDraftScope);
    setVisitFormError("");setEditingVisit(visit);setClientId(visit.clientId);setStaffId(visit.staffId||"");setDate(visit.date);
    setStartTime(visit.startTime);setEndTime(visit.endTime);setVisitTitle(visit.title);setVisitNotes(visit.notes||"");setCreating(true);
  }
  function startNewVisit(){
    setVisitFormError("");setEditingVisit(null);setClientId("");setStaffId("");setDate(today());setStartTime("09:00");setEndTime("10:00");setVisitTitle("Care visit");setVisitNotes("");
    setVisitFrequency("WEEKLY");setRepeatEvery("1");setRepeatUnit("WEEKS");setSelectedDays([]);setVisitEndDate("");setCreating(true);
  }
  function discardVisitDraft(){
    void clearFormDraft(visitDraftScope);
    setCreating(false);setEditingVisit(null);setVisitFormError("");
  }
  async function openVisit(v: Row) {
    setSelected(v); setQrCode(""); setQrUnavailable(false); setQrUnavailableReason(""); qrScanHandled.current=false; setScanningQr(false); setBusy(true);
    try { const sync=await flushPendingMutations(user.id); setSyncSummary(await pendingMutationSummary(user.id)); if(sync.pending) Alert.alert("Offline records need attention",`${sync.pending} visit record${sync.pending===1?"":"s"} could not be synchronised. Review the sync status before completing the visit.`); setDetail(await api(`/api/mobile/visits/${v.id}`)); }
    catch(e) { Alert.alert("Visit could not be opened",(e as Error).message); setSelected(null); }
    finally { setBusy(false); }
  }
  async function recordMedication() {
    if(!selected||!selectedMedication)return;
    setBusy(true);
    try {
      const outcome=medicationOutcome;
      const result=await apiOrQueue(`/api/mobile/visits/${selected.id}/medication-administrations`,{
        clientEventId:clientEventId(),medicationId:selectedMedication.id,outcome,
        slot:medicationSlot.trim()||selectedMedication.slots?.[0]||selectedMedication.exactTimes&&Object.values(selectedMedication.exactTimes)[0]||"During visit",
        doseGiven:["ADMINISTERED","PRN_ADMINISTERED"].includes(outcome)?selectedMedication.dose||"As prescribed":"",
        reason:medicationReason.trim(),note:medicationNote.trim(),prnEffect:"",witnessedBy:medicationWitness||null,quantityGiven:selectedMedication.stockTrackingEnabled?Number(medicationQuantity):null,allergyAcknowledged:!detail?.allergyInformation||medicationAllergyAcknowledged,bodyMapAcknowledged:!bodyMapText(selectedMedication.bodyMapData)||medicationBodyMapAcknowledged,occurredAt:new Date().toISOString()
      },user.id,`Medication: ${selectedMedication.name}`);
      if(result.queued) {setSyncSummary(await pendingMutationSummary(user.id));Alert.alert("Saved securely for synchronisation","The phone is offline. This medication record is encrypted on this device and will be sent in order when a connection is available. Please follow your organisation's offline escalation procedure.");}
      else { Alert.alert("Medication recorded","The eMAR record has been saved and added to the visit audit history."); setDetail(await api(`/api/mobile/visits/${selected.id}`)); }
      setSelectedMedication(null);setMedicationReason("");setMedicationNote("");setMedicationOutcome("ADMINISTERED");setMedicationSlot("");setMedicationQuantity("1");setMedicationWitness("");setMedicationAllergyAcknowledged(false);setMedicationBodyMapAcknowledged(false);
    } catch(e){Alert.alert("Medication could not be recorded",(e as Error).message)} finally{setBusy(false)}
  }
  async function attendance(event: "CHECK_IN" | "CHECK_OUT") {
    if (!selected) return;
    if (event === "CHECK_IN" && detail?.qrCheckInRequired && !qrCode && (!qrUnavailable || qrUnavailableReason.trim().length < 10)) {
      Alert.alert("QR check-in verification", "Scan the client's QR code or explain why it is unavailable (at least 10 characters).");
      return;
    }
    setBusy(true);
    try {
      let coordinates = { latitude:null as number|null, longitude:null as number|null, accuracy:null as number|null };
      const servicesEnabled=await Location.hasServicesEnabledAsync();
      if(!servicesEnabled) throw new Error("Turn on location services before checking in or out.");
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status !== "granted") throw new Error("Location permission is required to verify visit attendance.");
      const p=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      coordinates={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};
      if(event==="CHECK_IN"){
        stopArrivalWatching();
        if(user.role==="CAREGIVER"&&p.coords.accuracy!=null)
          await api(`/api/mobile/visits/${selected.id}/proximity`,"POST",coordinates).catch(()=>{});
      }
      const attendancePath=`/api/mobile/visits/${selected.id}/attendance`;
      const qrException=event==="CHECK_IN"&&!!detail?.qrCheckInRequired&&qrUnavailable&&!qrCode;
      const attendanceBody={clientEventId:clientEventId(),event,...coordinates,...(event==="CHECK_IN"&&qrCode?{qrCode}:{}),qrUnavailableReason:qrException?qrUnavailableReason.trim():"",locationExceptionReason:event==="CHECK_IN"?locationExceptionReason.trim():""};
      // A QR exception must reach the office immediately, so do not queue it offline.
      const result=qrException?{data:await api<Row>(attendancePath,"POST",attendanceBody),queued:false}:await apiOrQueue(attendancePath,attendanceBody,user.id,event==="CHECK_IN"?"Visit check-in":"Visit check-out");
      if(result.queued){setSyncSummary(await pendingMutationSummary(user.id));const status=event==="CHECK_IN"?"IN_PROGRESS":"COMPLETED";setDetail((current)=>current?{...current,visit:{...current.visit,status}}:current);setSelected({...selected,status});Alert.alert("Attendance saved securely",`${event==="CHECK_IN"?"Check-in":"Check-out"} is pending synchronisation. Keep the app installed and review sync status when connectivity returns.`);}
      else {const attendanceResult=result.data as Row;if(event==="CHECK_IN") Alert.alert("Check-in recorded",attendanceResult.qrException?"The visit has started without QR verification. Your explanation and location were recorded, and the office has been alerted for review.":attendanceResult.locationStatus==="VERIFIED"?`Client location verified${attendanceResult.distanceMetres!=null?` (${attendanceResult.distanceMetres} m)`:""}. The arrival record has been saved.`:attendanceResult.locationStatus==="OUTSIDE_RADIUS"?`You appear to be ${attendanceResult.distanceMetres} m from the configured client location. An exception alert has been sent to the admin for review.`:"Attendance was recorded, but this client's address needs map coordinates. An admin setup alert has been created; this is not recorded as a caregiver location failure.");const updated=await api<Row>(`/api/mobile/visits/${selected.id}`);setDetail(updated);setSelected({...selected,status:updated.visit.status});}
      if(event==="CHECK_IN"){
        setLocationExceptionReason("");
        setQrCode("");
        setQrUnavailable(false);
        setQrUnavailableReason("");
        try{await startLocationTracking(selected.id)}catch(error){Alert.alert("Check-in saved; tracking paused",(error as Error).message)}
      }else await stopLocationTracking();
      refresh();
    } catch (e) {
      Alert.alert("Attendance could not be recorded", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function handleQrScan(data:string) {
    if(qrScanHandled.current)return;
    qrScanHandled.current=true;
    setScanningQr(false);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
      Alert.alert("Wrong QR code","That is not a Caremonitor client QR code. Tap Scan client QR code to try again.");
      return;
    }
    setQrCode(data);
    setQrUnavailable(false);
    setQrUnavailableReason("");
  }
  async function record(kind:string,title:string,body:string,status:string,category="",clinical?:{type:string;value:string}) {
    if(!selected) return; setBusy(true);
    try { const result=await apiOrQueue(`/api/mobile/visits/${selected.id}/entries`,{clientEventId:clientEventId(),kind,title,body,category,status,...(clinical?{clinical}:{})},user.id,kind==="ACTIVITY"?`Care task: ${title}`:kind==="ALERT"?"Incident alert":kind==="OBSERVATION"?`Observation: ${title}`:"Visit note"); if(result.queued){setSyncSummary(await pendingMutationSummary(user.id));Alert.alert("Saved securely for synchronisation",`${title} is pending and will be sent in order when a connection is available.`);}else setDetail(await api(`/api/mobile/visits/${selected.id}`)); if(kind==="NOTE")setNote(""); if(kind==="ALERT")setIncident(""); if(kind==="ACTIVITY"&&status==="NOT_COMPLETED"){setIncompleteTask(null);setTaskReason("");} if(kind==="OBSERVATION"){setObservation("");if(category.startsWith("CLINICAL_"))setClinicalValue("");if(category==="SKIN_INTEGRITY")setSkinConcern("");} }
    catch(e){Alert.alert("Record could not be saved",(e as Error).message)} finally{setBusy(false)}
  }
  async function addPhoto(source:"camera"|"library"="camera") {
    if(!selected) return;
    const permission=source==="camera"?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){Alert.alert("Photo permission needed",`Allow ${source==="camera"?"camera":"photo library"} access to add visit evidence.`);return;}
    const result=source==="camera"
      ?await ImagePicker.launchCameraAsync({mediaTypes:["images"],quality:.7,exif:false})
      :await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:.7,exif:false,allowsMultipleSelection:false});
    if(result.canceled)return;
    setBusy(true); try{let metadata:{latitude:number|null;longitude:number|null;accuracy:number|null;capturedAt:string|null}={latitude:null,longitude:null,accuracy:null,capturedAt:new Date().toISOString()};if(source==="camera")try{const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});metadata={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:new Date(position.timestamp).toISOString()}}catch{}const asset=result.assets[0];const saved=await uploadOrQueuePhoto(`/api/mobile/visits/${selected.id}/photos`,{uri:asset.uri,fileName:asset.fileName,mimeType:asset.mimeType,fileSize:asset.fileSize},caption,metadata,user.id);if(saved.queued){setSyncSummary(await pendingMutationSummary(user.id));Alert.alert("Photo saved for synchronisation","The photo is encrypted on this device and will be uploaded when a connection is available. Check the sync status before signing out.");}else{setDetail(await api(`/api/mobile/visits/${selected.id}`));Alert.alert("Photo uploaded","The care evidence is now attached to this visit and visible to authorised staff.");}setCaption("");}catch(e){Alert.alert("Photo could not be saved",(e as Error).message)}finally{setBusy(false)}
  }
  async function dictate(target:"note"|"incident") {
    try {
      const {ExpoSpeechRecognitionModule}=await import("expo-speech-recognition");
      if(!ExpoSpeechRecognitionModule.isRecognitionAvailable()) throw new Error("Speech recognition is not enabled on this device.");
      const permission=await ExpoSpeechRecognitionModule.requestPermissionsAsync(); if(!permission.granted)throw new Error("Microphone and speech recognition permission are required.");
      setListening(target);
      const result=ExpoSpeechRecognitionModule.addListener("result",(event:any)=>{const text=event.results?.[0]?.transcript?.trim();if(!text)return;const update=(previous:string)=>`${previous}${previous.trim()?" ":""}${text}`;target==="note"?setNote(update):setIncident(update);});
      const end=ExpoSpeechRecognitionModule.addListener("end",()=>{setListening(null);result.remove();end.remove();error.remove();});
      const error=ExpoSpeechRecognitionModule.addListener("error",(event:any)=>{setListening(null);if(event.error!=="aborted"&&event.error!=="no-speech")Alert.alert("Voice dictation stopped",event.message||"Speech was not recognised.");result.remove();end.remove();error.remove();});
      ExpoSpeechRecognitionModule.start({lang:"en-GB",interimResults:false,continuous:false,contextualStrings:["medication","care plan","check in","check out","wellbeing","hydration"]});
    } catch(e) { setListening(null); Alert.alert("Voice dictation unavailable",(e as Error).message+" A development build is required; the phone keyboard's dictation remains available in Expo Go."); }
  }
  const visitStatus=detail?.visit?.status;
  const activeVisit=visitStatus==="IN_PROGRESS";
  const visitMinutes=detail?.visit?.actual_start?Math.max(0,Math.floor(((detail.visit.actual_end?new Date(detail.visit.actual_end).valueOf():clock)-new Date(detail.visit.actual_start).valueOf())/60000)):0;
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    >
      <Text style={styles.title}>Assigned client visits</Text>
      <Text style={styles.muted}>Select an assigned client visit, check in, record care, then check out. All visit times are Europe/London.</Text>
      {user.role!=="CAREGIVER"&&!selected&&<Button title={creating?"Cancel new visit":"Add visit"} onPress={()=>{if(creating)discardVisitDraft();else startNewVisit()}}/>}
      {creating&&<Card>
        <Text style={styles.heading}>{editingVisit?"Edit visit and caregiver":"New scheduled visit"}</Text>
        <ErrorText error={visitFormError} />
        <Text style={styles.muted}>Client</Text>
        {options.data?.clients.map(p=><Card key={p.id} onPress={()=>setClientId(p.id)}><Text style={styles.text}>{clientId===p.id?"✓ ":""}{p.name}</Text></Card>)}
        <Text style={styles.muted}>Assign caregiver (optional)</Text>
        {options.data?.staff.map(p=><Card key={p.id} onPress={()=>setStaffId(staffId===p.id?"":p.id)}><Text style={styles.text}>{staffId===p.id?"✓ ":""}{p.name}</Text></Card>)}
        <DateInput label="Visit date" value={date} onChangeText={setDate}/>
        <View style={styles.row}><View style={{flex:1}}><TimeInput label="Starts" value={startTime} onChangeText={setStartTime}/></View><View style={{flex:1}}><TimeInput label="Ends" value={endTime} onChangeText={setEndTime}/></View></View>
        {!editingVisit&&<>
          <Text style={styles.muted}>Repeat schedule</Text>
          <View style={styles.row}>{(["DAILY","WEEKLY","CUSTOM"] as const).map(frequency=><Button key={frequency} title={frequency[0]+frequency.slice(1).toLowerCase()} variant="secondary" selected={visitFrequency===frequency} onPress={()=>setVisitFrequency(frequency)}/>)}</View>
          {visitFrequency!=="DAILY"&&<><Text style={styles.muted}>Repeat on (leave clear to use the visit date's day)</Text><View style={styles.row}>{repeatDays.map(([short,day])=><Button key={day} title={short} variant="secondary" selected={selectedDays.includes(day)} onPress={()=>setSelectedDays(days=>days.includes(day)?days.filter(value=>value!==day):[...days,day])}/>)}</View></>}
          <View style={styles.row}><View style={{flex:1}}><Input label="Repeats every" value={repeatEvery} onChangeText={setRepeatEvery} keyboardType="number-pad" maxLength={2}/></View><View style={{flex:1}}><Text style={styles.muted}>Unit</Text><View style={styles.row}><Button title="Days" variant="secondary" selected={repeatUnit==="DAYS"} onPress={()=>setRepeatUnit("DAYS")}/><Button title="Weeks" variant="secondary" selected={repeatUnit==="WEEKS"} onPress={()=>setRepeatUnit("WEEKS")}/></View></View></View>
          <DateInput label="Ends (optional)" value={visitEndDate} onChangeText={setVisitEndDate} optional minDate={date}/>
          {!visitEndDate&&<Text style={styles.muted}>Leave this empty to create visits for the next 12 weeks. You can add a future schedule later.</Text>}
        </>}
        <Input label="Visit title" value={visitTitle} onChangeText={setVisitTitle} maxLength={160}/>
        <Input label="Instructions" value={visitNotes} onChangeText={setVisitNotes} multiline maxLength={4000}/>
        <Text style={styles.muted}>{editingVisit?"Changes are saved when you choose Save changes.":"This unfinished visit schedule is saved securely on this device while you type."}</Text>
        <View style={styles.row}><Button title="Cancel" variant="secondary" onPress={discardVisitDraft}/><Button title={busy?"Saving…":editingVisit?"Save changes":"Create visit"} disabled={busy||!clientId||!visitTitle.trim()} onPress={()=>void saveVisit()}/></View>
      </Card>}
      <View style={styles.row}>
        <Button
          title="Previous"
          variant="secondary"
          onPress={() => {
            setDate(addDays(date, -1));
            setSelected(null);
          }}
        />
        <Button
          title="Today"
          variant="secondary"
          selected={date===today()}
          onPress={() => {
            setDate(today());
            setSelected(null);
          }}
        />
        <Button
          title="Next"
          variant="secondary"
          disabled={user.role==="CAREGIVER"&&date>=addDays(today(),6)}
          onPress={() => {
            setDate(addDays(date, 1));
            setSelected(null);
          }}
        />
      </View>
      <Text style={styles.heading}>{date}</Text>
      <ErrorText error={error} />
      {!selected&&user.role==="CAREGIVER"&&date===today()&&<Card>
        <Text style={styles.heading}>My next seven days</Text>
        <Text style={styles.muted}>Only your assigned visits appear here. Tap a visit to open its latest care record.</Text>
        <ErrorText error={week.error}/>
        {week.loading&&<Text style={styles.muted}>Loading your rota…</Text>}
        {week.data?.visits.map(visit=><Card key={visit.id}>
          <Text style={styles.badge}>{visit.date} · {visit.startTime}–{visit.endTime} · {visitDuration(visit.startTime,visit.endTime)}</Text>
          <Text style={styles.heading}>{visit.clientName}</Text>
          {!!visit.clientAddress&&<Text style={styles.text}>{visit.clientAddress}</Text>}
          <Text style={styles.muted}>{visit.staffName||"Unassigned"} · {visit.status.replaceAll("_"," ")}</Text>
          <Button variant="secondary" title="Open visit" onPress={()=>{setDate(visit.date);void openVisit(visit)}}/>
        </Card>)}
        {week.data?.visits.length===0&&<Text style={styles.muted}>No assigned visits in the next seven days.</Text>}
        <Button variant="secondary" title="Refresh seven-day rota" onPress={week.refresh}/>
      </Card>}
      {!selected&&user.role==="CAREGIVER"&&!!openShifts.data?.visits.length&&<><Text style={styles.heading}>Available open shifts</Text>{openShifts.data.visits.map(v=><Card key={v.id}><Text style={styles.badge}>{v.startTime} – {v.endTime}</Text><Text style={styles.heading}>{v.clientName}</Text><Text style={styles.text}>{v.title}{v.requiredStaff>1?` · double-up position ${v.slotIndex} of ${v.requiredStaff}`:""}</Text><Button disabled={busy} title="Claim shift" onPress={async()=>{setBusy(true);try{await api(`/api/roster/visits/${v.id}/claim`,"POST",{});Alert.alert("Shift assigned","The visit is now in your schedule.");openShifts.refresh();refresh()}catch(e){Alert.alert("Shift could not be assigned",(e as Error).message)}finally{setBusy(false)}}}/></Card>)}</>}
      {selected ? (
        <>
          <Button title="Back to visits" variant="secondary" onPress={() => {void stopLocationTracking();stopArrivalWatching();setSelected(null);setDetail(null)}} />
          <Button title="Refresh visit and care information" variant="secondary" disabled={busy} onPress={()=>void api<Row>(`/api/mobile/visits/${selected.id}`).then(setDetail).catch((e)=>Alert.alert("Unable to refresh",(e as Error).message))}/>
          {(syncSummary.pending>0||syncSummary.lastSyncAt)&&<Card><Text style={styles.heading}>Offline sync status</Text><Text style={syncSummary.blocked?styles.error:styles.badge}>{syncSummary.pending?`${syncSummary.pending} pending · ${syncSummary.blocked} need attention`:`Up to date${syncSummary.lastSyncAt?` · ${timestamp(syncSummary.lastSyncAt)}`:""}`}</Text>{syncSummary.items.slice(0,5).map(item=><Text key={item.id} style={item.lastError?styles.error:styles.muted}>{item.label||"Visit record"} · {item.lastError||"Waiting to send"}</Text>)}<Button disabled={busy} title={busy?"Synchronising…":"Synchronise now"} onPress={()=>void synchroniseNow()}/></Card>}
          <Text style={styles.heading}>Client information</Text>
          <Card>
          <View style={styles.row}>{!!detail?.visit?.clientPhoto&&<Image source={{uri:`${API_URL}/${String(detail.visit.clientPhoto).replace(/^\//,"")}`}} style={{width:56,height:56,borderRadius:28}} accessibilityLabel={`${selected.clientName} profile photo`}/>}<Text style={styles.heading}>{selected.clientName}</Text></View>
          <Text style={styles.text}>{selected.title}</Text>
          <Text style={styles.badge}>
            {selected.startTime} – {selected.endTime}
          </Text>
          <Text style={styles.muted}>
            {selected.staffName || "Unassigned"} ·{" "}
            {selected.status.replaceAll("_", " ")}
          </Text>
          {user.role!=="CAREGIVER"&&["DRAFT","SCHEDULED"].includes(selected.status)&&<Button title="Edit assignment" variant="secondary" onPress={()=>editVisit(selected)}/>}
          <Text style={styles.text}>{selected.notes || "No visit instructions."}</Text>
          {detail?.address && <Text style={styles.text}>Address: {[detail.address.addressLine1,detail.address.city,detail.address.postalCode||detail.address.postCode].filter(Boolean).join(", ")}</Text>}
          {detail?.visit?.clientPhone && <Text style={styles.text}>Phone: {detail.visit.clientPhone}</Text>}
          </Card>
          <Card><Text style={styles.heading}>Client information and safety</Text>
            {!!detail?.address?.accessDetails&&<Text style={styles.text}>Access instructions: {detail.address.accessDetails}</Text>}
            {!!detail?.clientInformation?.routinesAndPreferences&&<Text style={styles.text}>Routines and preferences: {detail.clientInformation.routinesAndPreferences}</Text>}
            {!!detail?.clientInformation?.carerPreferences&&<Text style={styles.text}>Caregiver preferences: {detail.clientInformation.carerPreferences}</Text>}
            {!!detail?.clientInformation?.otherPreferences&&<Text style={styles.text}>Other preferences: {detail.clientInformation.otherPreferences}</Text>}
            {!!detail?.clientInformation?.communicationOrInformationNeeds&&<Text style={styles.text}>Communication needs: {detail.clientInformation.communicationOrInformationNeeds}</Text>}
            {!!detail?.clientInformation?.allergiesIntolerances&&<Text style={styles.error}>Allergies and intolerances: {detail.clientInformation.allergiesIntolerances}</Text>}
            {!!detail?.clientInformation?.hospitalName&&<Text style={styles.text}>Hospital: {detail.clientInformation.hospitalName}</Text>}
            {!!detail?.clientInformation?.medicalHistory?.length&&<Text style={styles.text}>Medical history: {detail.clientInformation.medicalHistory.join(", ")}</Text>}
            {!!detail?.clientInformation?.overallRiskLevel&&<Text style={styles.error}>Overall risk: {detail.clientInformation.overallRiskLevel}</Text>}
            {!!detail?.clientInformation?.riskLevelDetails&&<Text style={styles.text}>Risk details: {detail.clientInformation.riskLevelDetails}</Text>}
            {detail?.keyContacts?.map((contact:Row,index:number)=><Text key={`${contact.name}-${index}`} style={styles.text}>{contact.type||"Contact"}: {contact.name}{contact.relationship?` (${contact.relationship})`:""}{contact.phone?` · ${contact.phone}`:""}</Text>)}
            {!detail?.clientInformation?.routinesAndPreferences&&!detail?.clientInformation?.communicationOrInformationNeeds&&!detail?.clientInformation?.allergiesIntolerances&&!detail?.keyContacts?.length&&<Text style={styles.muted}>No additional profile guidance is recorded.</Text>}
          </Card>
          {!!detail?.upcomingVisits?.length&&<Card><Text style={styles.heading}>Next carer · upcoming visits</Text><Text style={styles.muted}>Assigned care team for this client in the seven days following this visit. Times are UK time.</Text>{detail.upcomingVisits.map((visit:Row,index:number)=><Text key={`${visit.date}-${visit.startTime}-${index}`} style={styles.text}>{visit.date} · {visit.startTime}–{visit.endTime}: {visit.caregiverName}</Text>)}</Card>}
          <Text style={styles.heading}>Care information</Text>
          {!!detail?.careOverview?.length&&<Card><Text style={styles.heading}>Care plan and risk assessments</Text>{detail.careOverview.map((section:Row)=><View key={section.key} style={{marginTop:10}}><Text style={styles.heading}>{section.title}</Text>{!!section.summary&&<Text style={styles.text}>{section.summary}</Text>}{section.risks?.map((risk:Row)=><Text key={risk.id} style={styles.error}>{risk.riskLevel?`${risk.riskLevel}: `:""}{risk.risk}{risk.mitigation?` · Precaution: ${risk.mitigation}`:""}</Text>)}{section.assessment?.map((item:Row,index:number)=><Text key={`${item.label}-${index}`} style={styles.text}>{item.label}: {item.value}</Text>)}</View>)}</Card>}
          {visitStatus==="SCHEDULED"&&<Card><Text style={styles.heading}>Recording starts after check-in</Text><Text style={styles.muted}>Review the visit, care plan, risks, tasks and medication before arrival. Check in to record care, medication, incidents and evidence.</Text></Card>}
          {["SCHEDULED","IN_PROGRESS","COMPLETED"].includes(visitStatus)&&<>
          {visitStatus!=="SCHEDULED"&&<Card><Text style={styles.heading}>{activeVisit?"Visit in progress":"Completed visit"}</Text><Text style={styles.badge}>{visitMinutes} minute{visitMinutes===1?"":"s"} recorded</Text><Text style={styles.muted}>{activeVisit?"The timer started at verified check-in and will stop at checkout.":"This actual duration is available for authorised invoice and staff-pay review."}</Text></Card>}
          <Text style={styles.heading}>Care delivery</Text>
          <Text style={styles.heading}>Care tasks</Text>
          {detail?.tasks?.map((t:Row)=><Card key={t.id}><Text style={styles.heading}>{t.essential?"Essential · ":""}{t.name}</Text><Text style={styles.muted}>{t.details||"No additional instructions"}</Text><Text style={styles.badge}>{t.status.replaceAll("_"," ")}</Text>{t.status==="PENDING"&&activeVisit&&<View style={styles.row}><Button disabled={busy} title="Done" onPress={()=>void record("ACTIVITY",t.name,"Completed during visit","COMPLETED",t.id)}/><Button disabled={busy} title="Not done" onPress={()=>{setIncompleteTask(t);setTaskReason("")}}/></View>}</Card>)}
          {incompleteTask&&activeVisit&&<Card><Text style={styles.heading}>Why was {incompleteTask.name} not completed?</Text><Input label="Reason for omission" value={taskReason} onChangeText={setTaskReason} multiline maxLength={1000}/><View style={styles.row}><Button title="Cancel" variant="secondary" onPress={()=>{setIncompleteTask(null);setTaskReason("")}}/><Button title="Record not done" disabled={busy||taskReason.trim().length<3} onPress={()=>void record("ACTIVITY",incompleteTask.name,`Reason: ${taskReason.trim()}`,"NOT_COMPLETED",incompleteTask.id)}/></View></Card>}
          {!detail?.tasks?.length&&<Empty text="No care tasks are due for this visit."/>}
          <Text style={styles.heading}>Medication checklist</Text>
          {detail?.medication?.map((m:Row)=>{const records=(detail.medicationAdministrations||[]).filter((a:Row)=>a.medicationId===m.id),pending=(m.dueSlots||[]).filter((slot:string)=>!records.some((a:Row)=>a.slot===slot)),complete=m.dueSlots?.length?pending.length===0:records.length>0;return <Card key={m.id}><Text style={styles.heading}>{m.name}</Text>{m.dose&&<Text style={styles.text}>Dose: {m.dose}</Text>}{m.route&&<Text style={styles.text}>Route: {m.route}</Text>}<Text style={styles.muted}>{m.instructions||"Follow the medication record instructions."}</Text>{!!bodyMapText(m.bodyMapData)&&<MedicationBodyMap value={bodyMapText(m.bodyMapData)}/>}{m.type==="PRN"&&<Text style={styles.badge}>PRN · Minimum interval {m.timeBetweenDoses||"as prescribed"} {m.timeBetweenUnit||""}</Text>}{m.dueSlots?.length>0&&<Text style={styles.badge}>Due during visit: {m.dueSlots.join(", ")}</Text>}{records.map((record:Row)=><Text key={record.id} style={styles.badge}>Recorded: {record.outcome.replaceAll("_"," ")} · {record.slot}</Text>)}{!complete&&detail?.visit?.status==="IN_PROGRESS"?<Button disabled={busy} title="Record medication" onPress={()=>{setSelectedMedication(m);setMedicationAllergyAcknowledged(false);setMedicationBodyMapAcknowledged(false);setMedicationOutcome(m.type==="PRN"?"PRN_ADMINISTERED":"ADMINISTERED");setMedicationSlot(pending[0]||m.slots?.[0]||"")}}/>:!complete?<Text style={styles.muted}>Check in before recording administration.</Text>:null}</Card>})}
          {!detail?.medication?.length&&<Empty text="No active medication schedule is listed."/>}
          {selectedMedication&&<Card>
            <Text style={styles.heading}>Record {selectedMedication.name}</Text>
            {selectedMedication.type==="PRN"&&<>
              <Text style={styles.text}>Minimum interval: {selectedMedication.timeBetweenDoses||"not configured"} {selectedMedication.timeBetweenUnit||""}</Text>
              <Text style={styles.text}>Maximum: {selectedMedication.maxDoseCount||"not configured"} dose(s) per {selectedMedication.maxDosePeriod||"?"} {selectedMedication.maxDoseUnit||""}</Text>
              {!!selectedMedication.medicalCondition&&<Text style={styles.text}>Condition: {selectedMedication.medicalCondition}</Text>}
              {!!selectedMedication.circumstances&&<Text style={styles.text}>Use when: {selectedMedication.circumstances}</Text>}
              {!!selectedMedication.clientExpression&&<Text style={styles.text}>Client may express a need by: {selectedMedication.clientExpression}</Text>}
              {!prnConfigured(selectedMedication)&&<Text style={styles.error}>The office must configure the PRN interval and maximum before this dose can be recorded.</Text>}
            </>}
            <Text style={styles.muted}>Select one outcome. Exceptions automatically create an alert for review.</Text>
            {!!detail?.allergyInformation&&['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&<Card><Text style={styles.error}>Recorded allergy information: {detail.allergyInformation}</Text><Button variant="secondary" selected={medicationAllergyAcknowledged} title={`${medicationAllergyAcknowledged?"✓ ":""}I reviewed this allergy information`} onPress={()=>setMedicationAllergyAcknowledged(value=>!value)}/></Card>}
            {!!bodyMapText(selectedMedication.bodyMapData)&&['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&<Card><Text style={styles.heading}>Medication application body map</Text><MedicationBodyMap value={bodyMapText(selectedMedication.bodyMapData)}/><Button variant="secondary" selected={medicationBodyMapAcknowledged} title={`${medicationBodyMapAcknowledged?"✓ ":""}I reviewed the application site`} onPress={()=>setMedicationBodyMapAcknowledged(value=>!value)}/></Card>}
            <View style={styles.row}>{(selectedMedication.type==="PRN"?["PRN_ADMINISTERED","REFUSED","NOT_AVAILABLE","OMITTED"]:["ADMINISTERED","REFUSED","NOT_AVAILABLE","OMITTED"]).map(outcome=><Button key={outcome} variant="secondary" selected={medicationOutcome===outcome} title={`${medicationOutcome===outcome?"✓ ":""}${outcome.replaceAll("_"," ")}`} onPress={()=>setMedicationOutcome(outcome)}/>)}</View>
            <Input label="MAR time slot" value={medicationSlot} onChangeText={setMedicationSlot} maxLength={80}/>
            {!['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&<Input label="Reason (required)" value={medicationReason} onChangeText={setMedicationReason} maxLength={500}/>}
            <Input label={medicationOutcome==="PRN_ADMINISTERED"?"Why was PRN medication needed?":"Medication note (optional)"} value={medicationNote} onChangeText={setMedicationNote} multiline maxLength={2000}/>
            {selectedMedication.stockTrackingEnabled&&['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&<><Text style={styles.badge}>Recorded stock: {selectedMedication.stockQuantity} {selectedMedication.stockUnit}</Text><Input label={`Quantity given (${selectedMedication.stockUnit})`} keyboardType="decimal-pad" value={medicationQuantity} onChangeText={setMedicationQuantity}/></>}
            {(selectedMedication.isControlledDrug||selectedMedication.requiresWitness)&&<><Text style={styles.muted}>A second active team member must witness this record.</Text>{detail?.witnesses?.map((witness:Row)=><Card key={witness.id} onPress={()=>setMedicationWitness(witness.id)}><Text style={styles.text}>{medicationWitness===witness.id?"✓ ":""}{witness.name}</Text></Card>)}</>}
            <View style={styles.row}><Button title="Cancel" variant="secondary" onPress={()=>{setSelectedMedication(null);setMedicationAllergyAcknowledged(false);setMedicationBodyMapAcknowledged(false)}}/><Button disabled={busy||(medicationOutcome==="PRN_ADMINISTERED"&&!prnConfigured(selectedMedication))||(!!detail?.allergyInformation&&['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&!medicationAllergyAcknowledged)||(!!bodyMapText(selectedMedication.bodyMapData)&&['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&!medicationBodyMapAcknowledged)||(!['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&medicationReason.trim().length<3)||(medicationOutcome==="PRN_ADMINISTERED"&&medicationNote.trim().length<3)||(selectedMedication.stockTrackingEnabled&&['ADMINISTERED','PRN_ADMINISTERED'].includes(medicationOutcome)&&!(Number(medicationQuantity)>0))||((selectedMedication.isControlledDrug||selectedMedication.requiresWitness)&&!medicationWitness)} title={busy?"Saving…":"Confirm eMAR record"} onPress={()=>void recordMedication()}/></View>
          </Card>}
          <Text style={styles.heading}>Recording</Text>
          <Text style={styles.heading}>Visit notes</Text>
          <Input label="What happened during the visit?" editable={activeVisit} multiline maxLength={10000} value={note} onChangeText={setNote}/>
          <Button disabled={Platform.OS === "web"||!activeVisit||!!listening} title={listening==="note"?"Listening…":"Dictate visit note"} onPress={()=>void dictate("note")}/>
          <View style={styles.row}><Button disabled={!activeVisit||busy||note.trim().length<2} title="Save note" onPress={()=>void record("NOTE","Visit note",note,"RECORDED")}/><Button disabled={!activeVisit||busy||note.trim().length<10} title="Assist summary" onPress={async()=>{try{const x=await api<Row>("/api/mobile/note-assist","POST",{text:note});Alert.alert("Review this summary",x.summary+(x.attention?.length?"\n\nNeeds attention:\n"+x.attention.join("\n"):""));}catch(e){Alert.alert("Summary unavailable",(e as Error).message)}}}/></View>
          <Text style={styles.heading}>Care observations</Text>
          <View style={styles.row}>{["Wellbeing","Mood","Food","Fluids","Personal care","Sleep"].map(type=><Button key={type} variant="secondary" selected={observationType===type} title={type} onPress={()=>setObservationType(type)}/>)}</View>
          <Input label={`${observationType} observation`} editable={activeVisit} multiline maxLength={2000} value={observation} onChangeText={setObservation}/>
          <Button disabled={!activeVisit||busy||observation.trim().length<2} title="Save observation" onPress={()=>void record("OBSERVATION",observationType,observation,"RECORDED",observationType.toUpperCase().replaceAll(" ","_"))}/>
          <Text style={styles.heading}>Clinical observations</Text>
          <Text style={styles.muted}>Record a measured value only when this is part of the client's care plan. Escalate an urgent concern using the incident alert below.</Text>
          <View style={styles.row}>{["Blood pressure","Blood glucose","Weight","Temperature","Pulse","Oxygen saturation","Other"].map(type=><Button key={type} variant="secondary" selected={clinicalType===type} title={type} onPress={()=>setClinicalType(type)}/>)}</View>
          <Input label={`${clinicalType} value${clinicalUnits[clinicalType]?` (${clinicalUnits[clinicalType]})`:""}`} editable={activeVisit} value={clinicalValue} onChangeText={setClinicalValue} maxLength={100}/>
          <Text style={styles.muted}>{clinicalType==="Blood pressure"?"Enter systolic/diastolic, for example 120/80.":clinicalType==="Other"?"Enter the measurement and its unit.":"Enter the measured number; the unit is shown above."}</Text>
          <Button disabled={!activeVisit||busy||!validClinicalValue(clinicalType,clinicalValue)} title="Save clinical observation" onPress={()=>void record("OBSERVATION",`Clinical: ${clinicalType}`,`${clinicalValue.trim()}${clinicalUnits[clinicalType]?` ${clinicalUnits[clinicalType]}`:""}`,"RECORDED",`CLINICAL_${clinicalType.toUpperCase().replaceAll(" ","_")}`,{type:clinicalType.toUpperCase().replaceAll(" ","_"),value:clinicalValue.trim()})}/>
          <Text style={styles.heading}>Skin integrity and body region</Text>
          <Text style={styles.muted}>Select the side and body region, then describe the concern. Add a photograph below only when your organisation permits it.</Text>
          <View style={styles.row}>{["Front","Back"].map(view=><Button key={view} variant="secondary" selected={skinView===view} title={view} onPress={()=>setSkinView(view)}/>)}</View>
          <View style={styles.row}>{["Left","Right","Centre"].map(side=><Button key={side} variant="secondary" selected={skinSide===side} title={side} onPress={()=>setSkinSide(side)}/>)}</View>
          <View style={styles.row}>{["Head","Neck","Chest","Abdomen","Back","Arm","Hand","Hip","Leg","Foot"].map(region=><Button key={region} variant="secondary" selected={skinRegion===region} title={region} onPress={()=>setSkinRegion(region)}/>)}</View>
          <SkinBodyMap side={`${skinView} ${skinSide}`} region={skinRegion}/>
          <Input label="Describe skin concern, size and appearance" editable={activeVisit} value={skinConcern} onChangeText={setSkinConcern} multiline maxLength={2000}/>
          <Button disabled={!activeVisit||busy||!skinRegion||skinConcern.trim().length<3} title="Save skin observation" onPress={()=>void record("OBSERVATION",`Skin: ${skinView} ${skinSide} ${skinRegion}`,skinConcern.trim(),"RECORDED","SKIN_INTEGRITY")}/>
          <Text style={styles.heading}>Photos</Text>
          {detail?.photoUploadsAllowed===false?<Text style={styles.muted}>Your organisation has disabled visit photo uploads.</Text>:<><Input label="Photo caption (optional)" editable={activeVisit} maxLength={500} value={caption} onChangeText={setCaption}/><Button disabled={Platform.OS === "web"||!activeVisit||busy} title="Take and upload photo" onPress={()=>void addPhoto("camera")}/><Button disabled={Platform.OS === "web"||!activeVisit||busy} title="Choose a photo from this device" variant="secondary" onPress={()=>void addPhoto("library")}/></>}
          {detail?.attachments?.map((a:Row)=><Card key={a.id}><Text style={styles.text}>{a.caption||a.name}</Text><Text style={styles.muted}>{timestamp(a.capturedAt||a.created_at)}{a.latitude!=null?" · location recorded":""}</Text></Card>)}
          {!!detail?.previousNotes?.length&&<Card><Text style={styles.heading}>Previous visit handover</Text>{detail.previousNotes.map((entry:Row)=><View key={entry.id} style={{marginTop:10}}><Text style={styles.badge}>{entry.date} · {entry.kind}</Text><Text style={styles.text}>{entry.title}</Text>{!!entry.body&&<Text style={styles.muted}>{entry.body}</Text>}</View>)}</Card>}
          <Text style={styles.heading}>Reporting</Text>
          <Text style={styles.heading}>Raise a concern or incident</Text>
          <View style={styles.row}>{["Health deterioration","Accident or injury","Safeguarding","Medication","Other"].map(category=><Button key={category} variant="secondary" selected={incidentCategory===category} title={category} onPress={()=>setIncidentCategory(category)}/>)}</View>
          <Input label="Concern or incident details" editable={activeVisit} multiline maxLength={10000} value={incident} onChangeText={setIncident}/>
          <Button disabled={Platform.OS === "web"||!activeVisit||!!listening} title={listening==="incident"?"Listening…":"Dictate concern details"} onPress={()=>void dictate("incident")}/>
          <Button disabled={!activeVisit||busy||incident.trim().length<2} title="Submit concern alert" onPress={()=>void record("ALERT",`${incidentCategory} concern`,incident,"OPEN",incidentCategory.toUpperCase().replaceAll(" ","_"))}/>
          {!!detail?.locationTrail?.length&&<Card><Text style={styles.heading}>Location audit</Text><Text style={styles.badge}>{detail.locationTrail.length} active-visit sample{detail.locationTrail.length===1?"":"s"}</Text><Text style={styles.muted}>Visible to authorised administrators in the web visit record.</Text></Card>}
          <Text style={styles.heading}>Recorded activity</Text>
          {detail?.entries?.map((e:Row)=><Card key={e.id}><Text style={styles.badge}>{e.kind} · {e.status}</Text><Text style={styles.heading}>{e.title}</Text>{e.body?<Text style={styles.text}>{e.body}</Text>:null}</Card>)}
          </>}
          <Text style={styles.heading}>Visit controls</Text>
          {Platform.OS === "web" && <Text style={styles.muted}>Browser preview: check-in, location, QR, camera, dictation and offline care recording require the installed Android or iOS app.</Text>}
          {detail?.visit?.status === "SCHEDULED" && <Card>
            {detail.qrCheckInRequired&&<>
              <Text style={styles.heading}>Client QR verification required</Text>
              <Text style={styles.muted}>{qrCode?"Client QR code scanned. Check in when ready.":"Scan the current QR code displayed at the client's location. If it is unavailable, explain why so the office can review the check-in."}</Text>
              {!qrUnavailable&&<Button disabled={Platform.OS === "web"} title={scanningQr?"Close QR scanner":"Scan client QR code"} variant="secondary" onPress={async()=>{if(scanningQr){qrScanHandled.current=true;setScanningQr(false);return}const permission=cameraPermission?.granted?cameraPermission:await requestCameraPermission();if(!permission.granted){Alert.alert("Camera permission needed","Allow camera access to scan the client's check-in QR code.");return}qrScanHandled.current=false;setScanningQr(true)}}/>}
              {scanningQr&&!qrUnavailable&&<CameraView style={{height:260,borderRadius:12,overflow:"hidden"}} facing="back" barcodeScannerSettings={{barcodeTypes:["qr"]}} onBarcodeScanned={({data})=>handleQrScan(data)}/>}
              {!qrCode&&<Button title={qrUnavailable?"Use QR scanner instead":"QR code unavailable"} variant="secondary" selected={qrUnavailable} onPress={()=>{setQrUnavailable(value=>!value);setQrUnavailableReason("");setScanningQr(false)}}/>}
              {qrUnavailable&&!qrCode&&<><Input label="Why is the client's QR code unavailable?" value={qrUnavailableReason} onChangeText={setQrUnavailableReason} multiline maxLength={500}/><Text style={styles.muted}>Enter at least 10 characters. Your location and explanation will be recorded and the office alerted. This requires a connection.</Text></>}
            </>}
            <Input label="If checking in away from the client address, explain why (optional)" value={locationExceptionReason} onChangeText={setLocationExceptionReason} multiline maxLength={500}/>
            <Button disabled={Platform.OS === "web"||busy||(!!detail.qrCheckInRequired&&!qrCode&&(!qrUnavailable||qrUnavailableReason.trim().length<10))} title="Check in" onPress={() => void attendance("CHECK_IN")}/>
            {user.role==="CAREGIVER"&&<><Text style={styles.muted}>To notify administrators when you reach 100 metres of this client, keep Caremonitor open and allow precise location.</Text><Button disabled={Platform.OS === "web"} title={arrivalWatching?"Stop arrival alerts":"Enable arrival alerts"} variant="secondary" onPress={()=>arrivalWatching?stopArrivalWatching():void startArrivalWatching(selected.id).catch(e=>Alert.alert("Arrival alerts unavailable",(e as Error).message))}/>{!!arrivalMessage&&<Text style={styles.muted}>{arrivalMessage}</Text>}</>}
          </Card>}
          {detail?.visit?.status === "IN_PROGRESS" && <Card>
            <Text style={styles.heading}>Active-visit location</Text><Text style={styles.muted}>{tracking?`Tracking while Caremonitor is open${lastLocationAt?` · last update ${timestamp(lastLocationAt)}`:""}.`:"Location tracking is paused. Resume it while delivering this visit."}</Text><Button disabled={Platform.OS === "web"||busy} title={tracking?"Location tracking active":"Resume location tracking"} onPress={()=>{if(!tracking)void startLocationTracking(selected.id).catch(e=>Alert.alert("Tracking unavailable",(e as Error).message))}}/>
            <Button disabled={Platform.OS === "web"||busy} title="Check out and complete" onPress={() => void attendance("CHECK_OUT")}/>
          </Card>}
          {visitStatus==="DRAFT"&&<Text style={styles.muted}>This visit is awaiting schedule confirmation and cannot be started yet.</Text>}
        </>
      ) : data?.visits.length ? (
        data.visits.map((v) => (
          <Card key={v.id} onPress={() => void openVisit(v)}>
            <Text style={styles.badge}>
              {v.startTime} – {v.endTime}
            </Text>
            <Text style={styles.heading}>{v.clientName}</Text>
            <Text style={styles.text}>{v.title}{visitDuration(v.startTime,v.endTime)?` · ${visitDuration(v.startTime,v.endTime)}`:""}</Text>
            {!!v.clientAddress&&<Text style={styles.text}>{v.clientAddress}</Text>}
            <Text style={styles.muted}>
              {v.staffName || "Unassigned"} · {v.status.replaceAll("_", " ")}
            </Text>
          </Card>
        ))
      ) : (
        !loading && <Empty text="No visits scheduled for this date." />
      )}
    </ScrollView>
  );
}
export function People({ kind,user,onOpenVisit }: { kind: "clients" | "team"; user:User; onOpenVisit?:(id:string)=>void }) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Row | null>(null),
    [feed,setFeed]=useState<Row[]>([]),
    [feedPage,setFeedPage]=useState(1),
    [feedHasMore,setFeedHasMore]=useState(false),
    [feedLoading,setFeedLoading]=useState(false),
    [handover,setHandover]=useState<Row[]>([]),
    [handoverPage,setHandoverPage]=useState(1),
    [handoverHasMore,setHandoverHasMore]=useState(false),
    [handoverLoading,setHandoverLoading]=useState(false),
    [feedBody,setFeedBody]=useState(""),
    [feedKind,setFeedKind]=useState(kind==="clients"?"NOTE":"NOTE"),
    [feedBusy,setFeedBusy]=useState(false),
    [careTeam,setCareTeam]=useState<Row[]>([]),
    [documents,setDocuments]=useState<Row[]>([]),
    [medications,setMedications]=useState<Row[]>([]),
    [careOverview,setCareOverview]=useState<Row[]>([]),
    [profileSectionsError,setProfileSectionsError]=useState(""),
    [profileLoading,setProfileLoading]=useState(false),
    [clientInformation,setClientInformation]=useState<Row>({}),
    [todayVisits,setTodayVisits]=useState<Row[]>([]),
    [editing,setEditing]=useState(false),
    [personBusy,setPersonBusy]=useState(false),
    [personError,setPersonError]=useState(""),
    [firstName,setFirstName]=useState(""),
    [lastName,setLastName]=useState(""),
    [personEmail,setPersonEmail]=useState(""),
    [phone,setPhone]=useState(""),
    [dateOfBirth,setDateOfBirth]=useState(""),
    [role,setRole]=useState("CAREGIVER");
  const path =
    kind === "clients"
      ? "/api/client/get-all-clients"
      : "/api/team/get-all-users";
  const { data, error, loading, refresh } = useData<{
    users: Row[];
    totalCount: number;
  }>(path, "POST", { search, page, size: 20, isActive: true });
  async function open(id: string) {
    setProfileLoading(true);setProfileSectionsError("");
    try {
      const profile=await api<Row>(
          kind === "clients"
            ? `/api/client/get-client/${id}`
            : `/api/team/get-user/${id}`,
        );
      setSelected(profile);
      const [history,assignments,clientDocuments,overview,roster,medicationList,sharedHandover]=await Promise.allSettled([
        api<Row>(kind==="clients"?`/api/clients/${id}/feed?page=1`:`/api/team/${id}/feed?page=1`),
        kind==="clients"&&user.role!=="CAREGIVER"?api<{data:{careTeam:Row[]}}>(`/api/client-care-team/getByClient/${id}`,"POST",{page:1,size:100}):Promise.resolve(null),
        kind==="clients"?api<Row[]>(`/api/client-care-plan/files/${id}`):Promise.resolve([]),
        kind==="clients"?api<{sections:Row[];clientInformation:Row}>(`/api/mobile/clients/${id}/care-overview`):Promise.resolve(null),
        kind==="clients"?api<{visits:Row[]}>(`/api/roster/visits?from=${today()}&to=${today()}`):Promise.resolve(null),
        kind==="clients"&&user.role!=="CAREGIVER"?api<{medicationSchedules:Row[]}>(`/api/client-medication-scheduling/get-all-by-client-id/${id}`):Promise.resolve(null),
        kind==="clients"?api<{items:Row[];hasMore:boolean}>(`/api/mobile/clients/${id}/handover?page=1`):Promise.resolve(null)
      ]);
      const failed=[history,assignments,clientDocuments,overview,roster,medicationList,sharedHandover]
        .map((result,index)=>result.status==="rejected"?["History","Caregiver access","Documents","Care plan","Visits","Medication","Previous handover"][index]:null)
        .filter(Boolean);
      if(failed.length)setProfileSectionsError(`${failed.join(", ")} could not be loaded. Reopen this client to retry.`);
      const firstPage=history.status==="fulfilled"?(kind==="clients"?(history.value.items||[]):(history.value.entries||[])):[];
      setFeed(firstPage);setFeedPage(1);
      setFeedHasMore(history.status==="fulfilled"&&(kind==="clients"?firstPage.length===30:!!history.value.hasMore));
      setCareTeam(assignments.status==="fulfilled"?(assignments.value?.data?.careTeam||[]):[]);
      setDocuments(clientDocuments.status==="fulfilled"?clientDocuments.value:[]);
      setMedications(medicationList.status==="fulfilled"?(medicationList.value?.medicationSchedules||[]):[]);
      setCareOverview(overview.status==="fulfilled"?(overview.value?.sections||[]):[]);
      setClientInformation(overview.status==="fulfilled"?(overview.value?.clientInformation||{}):{});
      setTodayVisits(roster.status==="fulfilled"?(roster.value?.visits||[]).filter(visit=>visit.clientId===id):[]);
      setHandover(sharedHandover.status==="fulfilled"?(sharedHandover.value?.items||[]):[]);
      setHandoverHasMore(sharedHandover.status==="fulfilled"?!!sharedHandover.value?.hasMore:false);
      setHandoverPage(1);
    } catch (e) {
      Alert.alert("Unable to open profile", (e as Error).message);
    } finally {setProfileLoading(false)}
  }
  async function loadMoreHistory(){
    if(!selected||feedLoading||!feedHasMore)return;
    setFeedLoading(true);setProfileSectionsError("");
    try{
      const next=feedPage+1;
      const result=await api<Row>(kind==="clients"?`/api/clients/${selected.id}/feed?page=${next}`:`/api/team/${selected.id}/feed?page=${next}`);
      const items=kind==="clients"?(result.items||[]):(result.entries||[]);
      setFeed((current)=>[...current,...items]);setFeedPage(next);
      setFeedHasMore(kind==="clients"?items.length===30:!!result.hasMore);
    }catch(e){setProfileSectionsError(`Older history could not be loaded: ${(e as Error).message}`)}
    finally{setFeedLoading(false)}
  }
  async function loadMoreHandover(){
    if(!selected||handoverLoading||!handoverHasMore)return;
    setHandoverLoading(true);setProfileSectionsError("");
    try{const next=handoverPage+1;const result=await api<{items:Row[];hasMore:boolean}>(`/api/mobile/clients/${selected.id}/handover?page=${next}`);
      setHandover(current=>[...current,...result.items]);setHandoverPage(next);setHandoverHasMore(result.hasMore);
    }catch(e){setProfileSectionsError(`Older handover could not be loaded: ${(e as Error).message}`)}finally{setHandoverLoading(false)}
  }
  function editPerson(person:Row|null){
    setSelected(person);
    setFirstName(person?.firstName||"");
    setLastName(person?.lastName||"");
    setPersonEmail(person?.email||"");
    setPhone(person?.primaryPhone||"");
    setDateOfBirth(person?.dateOfBirth||"");
    setRole(person?.role==="ADMIN"?"ADMIN":"CAREGIVER");
    setPersonError("");
    setEditing(true);
  }
  async function savePerson(){
    if(!firstName.trim()||!lastName.trim()||!personEmail.trim())return;
    setPersonBusy(true);setPersonError("");
    try{
      const payload={firstName:firstName.trim(),lastName:lastName.trim(),email:personEmail.trim().toLowerCase(),primaryPhone:phone.trim(),...(kind==="team"?{role}:{dateOfBirth:dateOfBirth||null})};
      const saved=kind==="clients"
        ? await api<Row>("/api/client/create","POST",{...payload,...(selected?{id:selected.id}:{})})
        : await api<Row>(selected?`/api/team/update-user/${selected.id}`:"/api/team/create-user",selected?"PUT":"POST",payload);
      setEditing(false);refresh();
      if(saved?.id)await open(saved.id);
      Alert.alert("Saved",`${kind==="clients"?"Client":"Team member"} is available in Caremonitor.`);
    }catch(e){setPersonError((e as Error).message)}finally{setPersonBusy(false)}
  }
  async function addFeed(){
    if(!selected)return;setFeedBusy(true);
    try{
      if(kind==="clients") await api(`/api/clients/${selected.id}/entries`,"POST",{kind:feedKind,visitId:null,title:feedKind==="NOTE"?"Mobile note":feedKind==="ALERT"?"Mobile concern":"Mobile action",body:feedBody,category:"Mobile",status:feedKind==="NOTE"?"RECORDED":"OPEN"});
      else await api(`/api/team/${selected.id}/feed`,"POST",{kind:feedKind,body:feedBody});
      setFeedBody("");await open(selected.id);
    }catch(e){Alert.alert("Entry could not be saved",(e as Error).message)}finally{setFeedBusy(false)}
  }
  async function updateCareTeam(member:Row,enabled:boolean){
    if(!selected)return;setFeedBusy(true);
    try{
      await api(`/api/client-care-team/update/${selected.id}`,"PUT",{carerId:member.carerId,viewAccess:enabled,revokeViewaccess:!enabled,allowedToVisit:enabled,declineCarer:!enabled});
      const updated=await api<{data:{careTeam:Row[]}}>(`/api/client-care-team/getByClient/${selected.id}`,"POST",{page:1,size:100});
      setCareTeam(updated.data.careTeam);
      Alert.alert("Care team updated",`${member.firstName} ${member.lastName} ${enabled?"can now view this client and be assigned visits":"no longer has access to this client"}.`);
    }catch(e){Alert.alert("Care team could not be updated",(e as Error).message)}finally{setFeedBusy(false)}
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    >
      <Text style={styles.title}>
        {kind === "clients" ? "Clients" : "Team"}
      </Text>
      <ErrorText error={error} />
      <ErrorText error={profileSectionsError} />
      {profileLoading&&<Text style={styles.muted}>Loading client records…</Text>}
      {user.role!=="CAREGIVER"&&<Button title={editing?"Cancel editing":selected?"Edit profile":kind==="clients"?"Add client":"Add team member"} variant="secondary" onPress={()=>editing?setEditing(false):editPerson(selected)} />}
      {editing ? <Card>
        <Text style={styles.heading}>{selected?"Edit":"Add"} {kind==="clients"?"client":"team member"}</Text>
        <ErrorText error={personError}/>
        <Input label="First name" value={firstName} onChangeText={setFirstName} maxLength={120}/>
        <Input label="Last name" value={lastName} onChangeText={setLastName} maxLength={120}/>
        <Input label="Email" value={personEmail} onChangeText={setPersonEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254}/>
        <Input label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={25}/>
        {kind==="clients"&&<DateInput label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} optional/>}
        {kind==="team"&&<View style={styles.row}>
          <Button title="Caregiver" variant="secondary" selected={role==="CAREGIVER"} onPress={()=>setRole("CAREGIVER")}/>
          <Button title="Admin" variant="secondary" selected={role==="ADMIN"} onPress={()=>setRole("ADMIN")}/>
        </View>}
        <Button title={personBusy?"Saving…":"Save profile"} disabled={personBusy||!firstName.trim()||!lastName.trim()||!personEmail.trim()} onPress={()=>void savePerson()}/>
      </Card> : selected ? (
        <>
        <Card>
          <Button title="Back to list" onPress={() => setSelected(null)} />
          {kind==="clients"&&!!selected.profileImagePath&&<Image source={{uri:`${API_URL}/${String(selected.profileImagePath).replace(/^\//,"")}`}} style={{width:72,height:72,borderRadius:36}} accessibilityLabel={`${selected.firstName} ${selected.lastName} profile photo`}/>}
          <Text style={styles.heading}>
            {selected.firstName} {selected.lastName}
          </Text>
          {[
            ["Email", selected.email],
            ["Phone", selected.primaryPhone],
            ["Date of birth", selected.dateOfBirth],
            ["Groups", selected.groups],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <Text key={k} style={styles.text}>
                {k}: {String(v)}
              </Text>
            ))}
          {selected.addresses?.map((a: Row, i: number) => (
            <View key={i}>
              <Text style={styles.text}>{[a.addressLine1, a.addressLine2, a.city, a.postalCode||a.postCode].filter(Boolean).join(", ")}</Text>
              {!!a.accessDetails&&<Text style={styles.text}>Access instructions: {a.accessDetails}</Text>}
            </View>
          ))}
          {selected.keyContacts?.map((c: Row, i: number) => (
            <Text key={i} style={styles.text}>
              Contact:{" "}
              {[c.firstName, c.lastName, c.name, c.phone, c.primaryPhone]
                .filter(Boolean)
                .join(" ")}
            </Text>
          ))}
        </Card>
        {kind==="clients"&&<Card>
          <Text style={styles.heading}>Today's visit</Text>
          {todayVisits.map(visit=><View key={visit.id}>
            <Text style={styles.text}>{visit.startTime}–{visit.endTime} · {visit.title} · {visit.status.replaceAll("_"," ")}</Text>
            <Button title="Open visit and care record" onPress={()=>onOpenVisit?.(visit.id)}/>
          </View>)}
          {!todayVisits.length&&<Text style={styles.muted}>No visit for this client is assigned to you today.</Text>}
        </Card>}
        {kind==="clients"&&<Card>
          <Text style={styles.heading}>Care plan and risks</Text>
          {[
            ["Allergies and intolerances",clientInformation.allergiesIntolerances],
            ["Overall risk",clientInformation.overallRiskLevel],
            ["Risk details",clientInformation.riskLevelDetails],
            ["Communication needs",clientInformation.communicationOrInformationNeeds],
            ["Routines and preferences",clientInformation.routinesAndPreferences],
            ["Caregiver preferences",clientInformation.carerPreferences],
            ["Other preferences",clientInformation.otherPreferences],
            ["Medical support",clientInformation.medicalSupport],
            ["Hospital",clientInformation.hospitalName],
            ["Medical history",Array.isArray(clientInformation.medicalHistory)?clientInformation.medicalHistory.join(", "):clientInformation.medicalHistory],
            ["GP practice",clientInformation.gpPracticeName],
            ["GP practice identifier",clientInformation.gpPracticeIdentifier],
            ["GP",clientInformation.gpName],
            ["GP phone",clientInformation.gpPhoneNumber],
            ["Pharmacy",clientInformation.pharmacyName],
            ["Pharmacy phone",clientInformation.pharmacyPhoneNumber],
            ["Pharmacy address",clientInformation.pharmacyAddress],
            ["Pharmacy postcode",clientInformation.pharmacyPostCode],
          ].filter(([,value])=>!!value).map(([label,value])=><Text key={label} style={label.includes("risk")||label.includes("Allergies")?styles.error:styles.text}>{label}: {String(value)}</Text>)}
          {careOverview.map(section=><View key={section.key}>
            <Text style={styles.heading}>{section.title}</Text>
            {!!section.summary&&<Text style={styles.text}>{section.summary}</Text>}
            {section.risks?.map((risk:Row)=><Text key={risk.id} style={styles.text}>
              {risk.riskLevel?`${risk.riskLevel}: `:""}{risk.risk}{risk.mitigation?` — ${risk.mitigation}`:""}
            </Text>)}
            {section.assessment?.map((item:Row,index:number)=><Text key={`${item.label}-${index}`} style={styles.text}>{item.label}: {item.value}</Text>)}
          </View>)}
          {!careOverview.length&&<Text style={styles.muted}>No care plan summary is available.</Text>}
        </Card>}
        {kind==="clients"&&user.role!=="CAREGIVER"&&<ClinicalProfileEditor clientId={selected.id} info={clientInformation} onSaved={()=>void open(selected.id)}/>}
        {kind==="clients"&&user.role!=="CAREGIVER"&&<CarePlanManager clientId={selected.id} onSaved={()=>void open(selected.id)}/>}
        {kind==="clients"&&user.role!=="CAREGIVER"&&<TaskPlanManager clientId={selected.id} onSaved={()=>void open(selected.id)}/>}
        {kind==="clients"&&user.role!=="CAREGIVER"&&<PrnLimitsManager medications={medications} onSaved={()=>void open(selected.id)}/>}
        {kind==="clients"&&<Card>
          <Text style={styles.heading}>Documents</Text>
          {documents.map(document=><Button key={document.id} title={document.fileName||"Open document"} variant="secondary" onPress={()=>{
            try {
              const url=new URL(document.fileUrl,`${API_URL}/`);
              if(url.origin!==new URL(API_URL).origin) throw new Error("Unexpected document address");
              void Linking.openURL(url.toString()).catch((error)=>Alert.alert("Document unavailable",String(error)));
            } catch(e) {Alert.alert("Document unavailable",(e as Error).message)}
          }}/>)}
          {!documents.length&&<Text style={styles.muted}>No documents are available to your role.</Text>}
        </Card>}
        {kind==="clients"&&user.role!=="CAREGIVER"&&<Card><Text style={styles.heading}>Caregiver access</Text><Text style={styles.muted}>Assigning a caregiver here makes this client visible in their mobile app. Schedule visits separately in Visits. Review existing visit assignments on the web before revoking access.</Text>{careTeam.map(member=>{const enabled=member.viewAccess&&!member.revokeViewaccess&&!member.declineCarer;return <Card key={member.carerId}><Text style={styles.text}>{member.firstName} {member.lastName}</Text><Text style={styles.badge}>{enabled?"Can view client and receive visits":"No access"}</Text>{!enabled&&<Button disabled={feedBusy} title="Assign caregiver" variant="secondary" onPress={()=>void updateCareTeam(member,true)}/>}</Card>})}</Card>}
        {kind==="clients"&&<><Text style={styles.heading}>Previous visit handover</Text>
          <Text style={styles.muted}>Recorded notes and observations from completed visits, including other caregivers. Use this information for continuity of care.</Text>
          {handover.map(entry=><Card key={entry.id}><Text style={styles.badge}>{entry.date} · {entry.kind}</Text><Text style={styles.heading}>{entry.title}</Text><Text style={styles.text}>{entry.body}</Text><Text style={styles.muted}>Recorded by {entry.recordedBy}</Text></Card>)}
          {handoverHasMore&&<Button disabled={handoverLoading} title={handoverLoading?"Loading…":"Load older handover"} onPress={()=>void loadMoreHandover()}/>}
          {!handover.length&&<Empty text="No previous visit handover has been recorded."/>}
        </>}
        <Card>
          <Text style={styles.heading}>{kind==="clients"?"Client history":"Team history"}</Text>
          <View style={styles.row}>{(kind==="clients"?["NOTE","ALERT","ACTION"]:["NOTE","CONCERN","ACTION"]).map(k=><Button key={k} variant="secondary" selected={feedKind===k} title={(feedKind===k?"✓ ":"")+k.toLowerCase()} onPress={()=>setFeedKind(k)}/>)}</View>
          <Input label={kind==="clients"?"Add a note, concern or action":"Add a staff note, concern or action"} value={feedBody} onChangeText={setFeedBody} multiline maxLength={4000}/>
          <Button title={feedBusy?"Saving…":"Add to history"} disabled={feedBusy||!feedBody.trim()} onPress={()=>void addFeed()}/>
        </Card>
        {feed.map(item=><Card key={item.id}><Text style={styles.badge}>{item.kind} · {item.status||"RECORDED"}</Text><Text style={styles.heading}>{item.title||item.author||"History entry"}</Text><Text style={styles.text}>{item.body||item.notes||"No details recorded"}</Text><Text style={styles.muted}>{timestamp(item.occurred_at||item.createdAt||item.created_at)}</Text></Card>)}
        {feedHasMore&&<Button title={feedLoading?"Loading…":"Load older history"} disabled={feedLoading} onPress={()=>void loadMoreHistory()}/>}
        {!feed.length&&<Empty text="No history has been recorded yet."/>}
        </>
      ) : (
        <>
          <Input
            label="Search name or email"
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          {data?.users.map((p) => (
            <Card key={p.id} onPress={() => void open(p.id)}>
              <Text style={styles.heading}>
                {p.firstName} {p.lastName}
              </Text>
              <Text style={styles.muted}>{p.email}</Text>
            </Card>
          ))}
          {!loading && !data?.users.length && (
            <Empty text="No matching people. Client access is controlled by care-team assignment." />
          )}
          <View style={styles.row}>
            <Button
              title="Previous"
              disabled={page === 1}
              onPress={() => setPage((p) => p - 1)}
            />
            <Text style={styles.muted}>Page {page}</Text>
            <Button
              title="Next"
              disabled={page * 20 >= (data?.totalCount || 0)}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
export function Inbox({user}:{user:User}) {
  const [selected, setSelected] = useState<Row | null>(null),
    [compose, setCompose] = useState(false),
    [recipient, setRecipient] = useState(""),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [announcementDraft,setAnnouncementDraft]=useState(""),
    [announcementBusy,setAnnouncementBusy]=useState(false),
    [announcementError,setAnnouncementError]=useState(""),
    [announcementStatus,setAnnouncementStatus]=useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const list = useData<{ threads: Row[]; hasMore: boolean }>(
      `/api/inbox/threads?page=${page}`,
    ),
    people = useData<Row[]>("/api/inbox/people");
  const announcement=useData<{message:string;updatedAt:string|null}>("/api/mobile/announcement");
  useEffect(()=>{if(announcement.data)setAnnouncementDraft(announcement.data.message)},[announcement.data?.message]);
  const [messages, setMessages] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!selected) return;
    let active = true;
    async function load() {
      try {
        const result = await api<{ messages: Row[] }>(
          `/api/inbox/threads/${selected!.id}/messages`,
        );
        if (active) setMessages(result.messages);
        if (result.messages.length)
          await api(`/api/inbox/threads/${selected!.id}/read`, "POST", {
            throughSeq: result.messages.at(-1)!.seq,
          });
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected]);
  async function send() {
    if (compose && !recipient) { setError("Choose a recipient before sending."); return; }
    if (compose && !subject.trim()) { setError("Enter a subject before sending."); return; }
    if (!body.trim()) { setError(compose ? "Enter a message before sending." : "Enter a reply before sending."); return; }
    setBusy(true);
    setError("");
    try {
      if (compose) {
        const thread = await api<Row>("/api/inbox/threads", "POST", {
          subject,
          body,
          participantIds: [recipient],
        });
        setSelected(thread);
        setCompose(false);
        setSubject("");
      } else {
        await api(`/api/inbox/threads/${selected!.id}/messages`, "POST", {
          body,
        });
        setSelected({ ...selected });
      }
      setBody("");
      list.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl refreshing={list.loading} onRefresh={list.refresh} />
      }
    >
      <Text style={styles.title}>Inbox</Text>
      <ErrorText error={list.error} />
      <Card>
        <Text style={styles.heading}>Office announcement</Text>
        <ErrorText error={announcementError||announcement.error}/>
        {!!announcementStatus&&<Text style={styles.badge}>{announcementStatus}</Text>}
        {announcement.data?.message?<Text style={styles.text}>{announcement.data.message}</Text>:<Text style={styles.muted}>No current office announcement.</Text>}
        {announcement.data?.updatedAt&&<Text style={styles.muted}>Updated {timestamp(announcement.data.updatedAt)}</Text>}
        {user.role!=="CAREGIVER"&&<>
          <Input label="Announcement for this organisation" value={announcementDraft} onChangeText={value=>{setAnnouncementDraft(value);setAnnouncementError("");setAnnouncementStatus("")}} multiline maxLength={1000}/>
          <Button disabled={announcementBusy||announcementDraft.trim()===(announcement.data?.message||"")} title={announcementBusy?"Saving…":"Publish announcement"} onPress={async()=>{setAnnouncementBusy(true);setAnnouncementError("");setAnnouncementStatus("");try{await api("/api/mobile/announcement","PUT",{message:announcementDraft.trim()});announcement.refresh();setAnnouncementStatus("Announcement published. Caregivers will see it in Inbox.");if(Platform.OS!=="web")Alert.alert("Announcement published","Caregivers in this organisation will see it when they open Inbox.")}catch(e){setAnnouncementError((e as Error).message);if(Platform.OS!=="web")Alert.alert("Could not publish",(e as Error).message)}finally{setAnnouncementBusy(false)}}}/>
        </>}
        <Button title="Refresh announcement" variant="secondary" onPress={announcement.refresh}/>
      </Card>
      {compose ? (
        <>
          <Button title="Cancel" onPress={() => {setCompose(false);setError("")}} />
          <Text style={styles.muted}>Choose recipient</Text>
          {people.data?.map((p) => (
            <Card key={p.id} onPress={() => {setRecipient(p.id);setError("")}}>
              <Text style={styles.text}>
                {recipient === p.id ? "✓ " : ""}
                {p.name}
              </Text>
            </Card>
          ))}
          {!people.data?.length && (
            <Empty text="There are no other active staff members yet." />
          )}
          <Input
            label="Subject"
            value={subject}
            onChangeText={value=>{setSubject(value);setError("")}}
            maxLength={160}
          />
          <Input
            label="Message"
            value={body}
            onChangeText={value=>{setBody(value);setError("")}}
            maxLength={6000}
            multiline
          />
          <Text style={styles.muted}>Select a recipient and enter both a subject and a message to send.</Text>
          <ErrorText error={error}/>
          <Button
            title="Send"
            disabled={busy}
            onPress={() => void send()}
          />
        </>
      ) : selected ? (
        <>
          <Button
            title="Back to inbox"
            onPress={() => {
              setSelected(null);
              setMessages([]);
              setBody("");
              list.refresh();
            }}
          />
          <Text style={styles.heading}>{selected.subject}</Text>
          <Text style={styles.muted}>
            Latest 50 messages. Refreshes every 15 seconds.
          </Text>
          {messages.map((m) => (
            <Card key={m.id}>
              <Text style={styles.badge}>{m.sender}</Text>
              <Text style={styles.text}>{m.body}</Text>
              <Text style={styles.muted}>{timestamp(m.createdAt)}</Text>
            </Card>
          ))}
          <Input
            label="Reply"
            multiline
            maxLength={6000}
            value={body}
            onChangeText={value=>{setBody(value);setError("")}}
          />
          <ErrorText error={error}/>
          <Button
            title="Send reply"
            disabled={busy}
            onPress={() => void send()}
          />
        </>
      ) : (
        <>
          <Button
            title="New conversation"
            onPress={() => {
              setCompose(true);
              setRecipient("");
              setBody("");
              setSubject("");
              setError("");
            }}
          />
          {list.data?.threads.map((t) => (
            <Card
              key={t.id}
              onPress={() => {
                setSelected(t);
                setMessages([]);
                setError("");
              }}
            >
              <Text style={styles.heading}>
                {t.subject}
                {t.unread ? " (" + t.unread + ")" : ""}
              </Text>
              <Text style={styles.muted}>{t.preview}</Text>
            </Card>
          ))}
          {!list.loading && !list.data?.threads.length && (
            <Empty text="No conversations yet." />
          )}
          <View style={styles.row}>
            <Button
              title="Previous"
              disabled={page === 1}
              onPress={() => setPage((p) => p - 1)}
            />
            <Button
              title="Next"
              disabled={!list.data?.hasMore}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
export function More({ user, logout, onProfileUpdated, deviceLock, changeDeviceLock, pushEnabled, changePush, initialSection = "" }: { user: User; logout: () => void; onProfileUpdated:(changes:Partial<User>)=>void; deviceLock:boolean; changeDeviceLock:(enabled:boolean)=>Promise<void>; pushEnabled:boolean; changePush:(enabled:boolean)=>Promise<void>; initialSection?:string }) {
  const [section, setSection] = useState(initialSection),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [securityBusy, setSecurityBusy] = useState(false),
    [leaveStart,setLeaveStart]=useState(""),
    [leaveEnd,setLeaveEnd]=useState(""),
    [leaveReason,setLeaveReason]=useState(""),
    [availabilityStart,setAvailabilityStart]=useState(""),
    [availabilityEnd,setAvailabilityEnd]=useState(""),
    [availabilityFrom,setAvailabilityFrom]=useState("09:00"),
    [availabilityTo,setAvailabilityTo]=useState("17:00"),
    [availabilityReason,setAvailabilityReason]=useState(""),
    [availabilityRequests,setAvailabilityRequests]=useState<Row[]>([]),
    [travelVisitId,setTravelVisitId]=useState(""),
    [travelMiles,setTravelMiles]=useState(""),
    [travelMinutes,setTravelMinutes]=useState(""),
    [travelNote,setTravelNote]=useState(""),
    [editingProfile,setEditingProfile]=useState(false),
    [profileFirst,setProfileFirst]=useState(user.firstName),
    [profileLast,setProfileLast]=useState(user.lastName),
    [profilePhone,setProfilePhone]=useState(user.primaryPhone||""),
    [caseKind,setCaseKind]=useState("INCIDENT"),
    [caseSeverity,setCaseSeverity]=useState("MEDIUM"),
    [caseTitle,setCaseTitle]=useState(""),
    [caseDescription,setCaseDescription]=useState(""),
    [caseClientId,setCaseClientId]=useState<string|null>(null),
    [caseReason,setCaseReason]=useState(""),
    [orgDecisionId,setOrgDecisionId]=useState(""),
    [orgDecisionStatus,setOrgDecisionStatus]=useState(""),
    [orgDecisionNotes,setOrgDecisionNotes]=useState("");
  const from = today().slice(0, 8) + "01",
    to = today();
  async function open(name: string) {
    setBusy(true);
    setError("");
    setSection(name);
    setData(null);
    try {
      if (["Accounting", "Invoices", "Staff pay", "Organisation settings"].includes(name)) return;
      if(name==="Availability"){
        setData(await api(`/api/team-availability/getAll/${user.id}`,"POST",{startDate:today(),endDate:addDays(today(),30)}));
        setAvailabilityRequests(await api<Row[]>("/api/mobile/me/availability-requests"));
        return;
      }
      if(name==="Governance"){
        const [overview,cases,clients]=await Promise.all([
          api<Row>("/api/governance/overview"),api<Row[]>("/api/governance/cases"),
          api<{users:Row[]}>("/api/client/get-all-clients","POST",{page:1,size:100,isActive:true})
        ]);
        setData({overview,cases,clients:clients.users});return;
      }
      if(name==="Platform"){
        setData(await api<Row>("/api/platform/organisations"));return;
      }
      const path =
        name === "Notifications"
          ? "/api/inbox/items?filter=OPEN&page=1"
          : name === "Timesheet"
          ? `/api/mobile/me/timesheet?from=${from}&to=${to}`
          : name === "Time off"
            ? "/api/mobile/me/time-off-requests"
          : name === "Leave requests"
              ? "/api/team/time-off-requests"
          : name === "Availability requests"
              ? "/api/team/availability-requests"
          : name === "Travel claims"
              ? "/api/mobile/admin/travel-claims"
          : name === "Reporting"
          ? `/api/reports/summary?from=${from}&to=${to}`
          : name === "Log"
            ? `/api/activity?from=${from}&to=${to}`
            : `/api/finance/documents?kind=${name === "Staff pay" ? "PAYRUN" : "INVOICE"}&from=${from}&to=${to}`;
      setData(await api(path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initialSection) void open(initialSection);
  }, [initialSection]);
  async function requestLeave(){
    setBusy(true);setError("");
    try {
      await api("/api/mobile/me/time-off-requests","POST",{startDate:leaveStart,endDate:leaveEnd||leaveStart,reason:leaveReason});
      setLeaveStart("");setLeaveEnd("");setLeaveReason("");await open("Time off");
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function requestAvailability(){
    setBusy(true);setError("");
    try{
      await api("/api/mobile/me/availability-requests","POST",{startDate:availabilityStart,endDate:availabilityEnd||availabilityStart,startTime:availabilityFrom,endTime:availabilityTo,reason:availabilityReason});
      setAvailabilityStart("");setAvailabilityEnd("");setAvailabilityReason("");await open("Availability");
      Alert.alert("Request sent","Your office will review these extra availability hours before they affect the rota.");
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function submitTravel(){
    setBusy(true);setError("");
    try{
      await api("/api/mobile/me/travel-claims","POST",{visitId:travelVisitId,miles:Number(travelMiles||0),minutes:Number(travelMinutes||0),note:travelNote.trim()});
      setTravelVisitId("");setTravelMiles("");setTravelMinutes("");setTravelNote("");await open("Timesheet");
      Alert.alert("Travel submitted","Your office will review it before it affects staff pay.");
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function saveProfile(){
    setBusy(true);setError("");
    try{
      const updated=await api<User>("/api/mobile/me/profile","PUT",{firstName:profileFirst.trim(),lastName:profileLast.trim(),primaryPhone:profilePhone.trim()});
      onProfileUpdated(updated);setEditingProfile(false);
      Alert.alert("Profile saved","Your updated details are available to your organisation.");
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function decideTravel(id:string,decision:"APPROVED"|"DECLINED"){
    setBusy(true);setError("");
    try{await api(`/api/mobile/admin/travel-claims/${id}/decision`,"POST",{decision});await open("Travel claims")}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function createQualityCase(){
    setBusy(true);setError("");
    try{
      await api("/api/governance/cases","POST",{clientId:caseClientId,kind:caseKind,severity:caseSeverity,title:caseTitle.trim(),description:caseDescription.trim()});
      setCaseTitle("");setCaseDescription("");setCaseClientId(null);await open("Governance");
      Alert.alert("Case recorded","The case is available to authorised administrators for investigation.");
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function updateQualityCase(id:string,revision:number,status:string){
    setBusy(true);setError("");
    try{await api(`/api/governance/cases/${id}/status`,"POST",{status,reason:caseReason.trim(),revision});setCaseReason("");await open("Governance")}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function decideOrganisation(){
    if(!orgDecisionId||!orgDecisionStatus)return;
    setBusy(true);setError("");
    try{
      await api(`/api/platform/organisations/${orgDecisionId}/status`,"PUT",{status:orgDecisionStatus,notes:orgDecisionNotes.trim()});
      setOrgDecisionId("");setOrgDecisionStatus("");setOrgDecisionNotes("");await open("Platform");
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function decideAvailability(id:string,decision:"APPROVED"|"DECLINED"){
    setBusy(true);setError("");
    try{await api(`/api/team/availability-requests/${id}/decision`,"POST",{decision});await open("Availability requests")}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function decideLeave(id:string,decision:"APPROVED"|"DECLINED"){
    setBusy(true);setError("");
    try{await api(`/api/team/time-off-requests/${id}/decision`,"POST",{decision});await open("Leave requests")}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{section === "Notifications" ? "Care alerts" : section === "Log" ? "Activity log" : section === "Platform" ? "Platform organisations" : section === "Time off" ? "Time off requests" : section === "Availability" ? "My availability" : section === "Timesheet" ? "My timesheet" : section || "My account"}</Text>
      {!section && <Text style={styles.muted}>{user.firstName} {user.lastName} · {user.role.toLowerCase()} · {user.email}</Text>}
      <ErrorText error={error} />
      {!section && Platform.OS !== "web" && <Button variant="secondary" title={pushEnabled?"Turn off device notifications":"Enable device notifications"} onPress={()=>void changePush(!pushEnabled).then(()=>Alert.alert("Notification setting saved",pushEnabled?"This device will no longer receive Caremonitor updates.":"This device can receive rota and office-message updates.")).catch(e=>Alert.alert("Notification setting unchanged",(e as Error).message))}/>}
      {section === "Notifications" && <><Text style={styles.muted}>Open alerts available to your role. Refresh by reopening this section; urgent matters still require your organisation's escalation process.</Text>{busy&&<Text style={styles.muted}>Loading...</Text>}{data?.items?.map((item:Row)=><Card key={item.id}><Text style={styles.badge}>{item.severity} · {item.state}</Text><Text style={styles.heading}>{item.title}</Text><Text style={styles.text}>{item.clientName}</Text><Text style={styles.muted}>{timestamp(item.createdAt)}</Text></Card>)}{data?.items?.length===0&&<Empty text="No open care alerts are assigned to you."/>}</>}
      {!section && <Card><Text style={styles.heading}>Profile</Text><Text style={styles.text}>{user.firstName} {user.lastName}</Text><Text style={styles.muted}>{user.email} · {user.role}</Text><Text style={styles.muted}>App version {Constants.expoConfig?.version || "unavailable"}</Text><Text style={styles.muted}>{Platform.OS === "web" ? "Browser preview: phone-only security and offline features must be checked in the installed app." : "Your session is stored in the device's secure storage. Contact your administrator to change your email or assigned client access."}</Text>
        {editingProfile?<><Input label="First name" value={profileFirst} onChangeText={setProfileFirst}/><Input label="Last name" value={profileLast} onChangeText={setProfileLast}/><Input label="Phone (optional)" value={profilePhone} onChangeText={setProfilePhone} keyboardType="phone-pad"/><Button disabled={busy||profileFirst.trim().length<2||profileLast.trim().length<2} title="Save profile" onPress={()=>void saveProfile()}/><Button variant="secondary" title="Cancel" onPress={()=>setEditingProfile(false)}/></>:<Button variant="secondary" title="Edit my profile" onPress={()=>setEditingProfile(true)}/>}
        {Platform.OS !== "web" && <Button variant="secondary" disabled={securityBusy} title={securityBusy?"Confirming security setting…":deviceLock?"Turn off device authentication":"Require device authentication on app return"} onPress={()=>{if(securityBusy)return;setSecurityBusy(true);void changeDeviceLock(!deviceLock).catch(e=>Alert.alert("Security setting unchanged",(e as Error).message)).finally(()=>setSecurityBusy(false));}}/>}
      </Card>}
      {user.role === "CAREGIVER" && <>
        {section==="Availability"&&<>
          <Text style={styles.heading}>Recorded availability</Text>
          <Text style={styles.muted}>These are the hours the office has recorded for you. Request extra hours below; an administrator must approve them before they affect the rota. Use Time off to request unavailable days.</Text>
          {Array.isArray(data)&&data.map((item:Row)=><Card key={item.id}>
            <Text style={styles.heading}>{item.startTime}–{item.endTime}</Text>
            <Text style={styles.text}>{item.frequency||"Availability"}{item.selectedDays?.length?` · ${item.selectedDays.join(", ")}`:""}</Text>
            <Text style={styles.muted}>{item.startDate}{item.endDate?` to ${item.endDate}`:" onward"}</Text>
          </Card>)}
          {Array.isArray(data)&&!data.length&&<Empty text="No availability hours are recorded for the next 30 days."/>}
          <Text style={styles.heading}>Request extra availability</Text>
          <DateInput label="First day" value={availabilityStart} onChangeText={setAvailabilityStart}/>
          <DateInput label="Last day (optional)" value={availabilityEnd} onChangeText={setAvailabilityEnd} optional minDate={availabilityStart}/>
          <TimeInput label="Available from" value={availabilityFrom} onChangeText={setAvailabilityFrom}/>
          <TimeInput label="Available until" value={availabilityTo} onChangeText={setAvailabilityTo}/>
          <Input label="Note to the office (optional)" value={availabilityReason} onChangeText={setAvailabilityReason} multiline maxLength={1000}/>
          <Button title="Send availability request" disabled={busy||!availabilityStart} onPress={()=>void requestAvailability()}/>
          {availabilityRequests.map((entry:Row)=><Card key={entry.id}><Text style={styles.text}>{entry.startDate} to {entry.endDate} · {entry.startTime}–{entry.endTime}</Text><Text style={styles.badge}>{entry.status}</Text>{!!entry.decisionNote&&<Text style={styles.muted}>{entry.decisionNote}</Text>}</Card>)}
        </>}
        {section === "Time off" && <>
          <DateInput label="First day" value={leaveStart} onChangeText={setLeaveStart}/>
          <DateInput label="Last day (optional)" value={leaveEnd} onChangeText={setLeaveEnd} optional minDate={leaveStart}/>
          <Input label="Reason (optional)" value={leaveReason} onChangeText={setLeaveReason} multiline maxLength={4000}/>
          <Button title="Send request" disabled={busy||!leaveStart} onPress={()=>void requestLeave()}/>
          {Array.isArray(data)&&data.map((entry:Row)=><Card key={entry.id}>
            <Text style={styles.heading}>{entry.startDate} to {entry.endDate}</Text>
            <Text style={styles.badge}>{entry.status}</Text>
            {!!entry.decisionNote&&<Text style={styles.text}>{entry.decisionNote}</Text>}
          </Card>)}
        </>}
        {section === "Timesheet" && busy && <Text style={styles.muted}>Loading...</Text>}
        {section === "Timesheet" && data && <>
          <Text style={styles.heading}>Recorded this month: {(data.workedMinutes / 60).toFixed(1)} hours</Text>
          <Text style={styles.muted}>Based on completed check-in and check-out times. Office-recorded travel: {Number(data.travelMinutes||0)} minutes · {Number(data.miles||0).toFixed(1)} miles.</Text>
          {data.visits.map((visit:Row)=><Card key={visit.id}>
            <Text style={styles.heading}>{visit.clientName} · {visit.date}</Text>
            <Text style={styles.text}>{visit.startTime}–{visit.endTime} · {visit.status}</Text>
            <Text style={styles.muted}>{visit.workedMinutes ? `${visit.workedMinutes} minutes recorded` : "No completed time recorded"}</Text>
            {(Number(visit.travelMinutes)>0||Number(visit.miles)>0)&&<Text style={styles.muted}>Travel: {Number(visit.travelMinutes||0)} minutes · {Number(visit.miles||0).toFixed(1)} miles</Text>}
            {!!visit.travelClaimStatus&&<Text style={styles.badge}>Travel claim: {visit.travelClaimStatus}{visit.travelDecisionNote?` · ${visit.travelDecisionNote}`:""}</Text>}
            {visit.status==="COMPLETED"&&(!visit.travelClaimStatus||visit.travelClaimStatus==="DECLINED")&&<Button variant="secondary" title="Claim travel time or mileage" onPress={()=>{setTravelVisitId(visit.id);setTravelMiles(String(visit.claimedMiles||""));setTravelMinutes(String(visit.claimedMinutes||""))}}/>}
          </Card>)}
          {!!travelVisitId&&<Card>
            <Text style={styles.heading}>Travel claim</Text>
            <Text style={styles.muted}>Enter actual travel for this completed visit. The office must approve it before it enters the pay record.</Text>
            <Input label="Miles travelled" keyboardType="decimal-pad" value={travelMiles} onChangeText={setTravelMiles}/>
            <Input label="Travel minutes" keyboardType="number-pad" value={travelMinutes} onChangeText={setTravelMinutes}/>
            <Input label="Travel note (optional)" value={travelNote} onChangeText={setTravelNote} multiline maxLength={1000}/>
            <Button disabled={busy||!(Number(travelMiles)>0||Number(travelMinutes)>0)||Number(travelMiles)<0||!Number.isInteger(Number(travelMinutes||0))||Number(travelMinutes)<0} title="Send travel claim" onPress={()=>void submitTravel()}/>
            <Button variant="secondary" title="Cancel" onPress={()=>setTravelVisitId("")}/>
          </Card>}
          {!data.visits.length && <Empty text="No visits this month." />}
        </>}
      </>}
      {user.role !== "CAREGIVER" && (
        <>
          {(section === "Reporting" || section === "Log") && <Text style={styles.muted}>
            This month: {from} to {to}. Review confirmed visit records before approving financial documents.
          </Text>}
          {section === "Accounting" && <AccountingManager />}
          {section === "Organisation settings" && <OrganisationSettings />}
          {section === "Invoices" && <FinanceManager kind="INVOICE" />}
          {section === "Staff pay" && <FinanceManager kind="PAYRUN" />}
          {section && busy && <Text style={styles.muted}>Loading...</Text>}
          {section === "Leave requests" && Array.isArray(data) && data.map((entry:Row)=><Card key={entry.id}>
            <Text style={styles.heading}>{entry.staffName}</Text>
            <Text style={styles.text}>{entry.startDate} to {entry.endDate} · {entry.type}</Text>
            {!!entry.reason&&<Text style={styles.text}>{entry.reason}</Text>}
            <Text style={styles.badge}>{entry.status}</Text>
            {entry.status==="PENDING"&&<View style={styles.row}>
              <Button title="Approve" disabled={busy} onPress={()=>void decideLeave(entry.id,"APPROVED")}/>
              <Button title="Decline" disabled={busy} variant="secondary" onPress={()=>void decideLeave(entry.id,"DECLINED")}/>
            </View>}
          </Card>)}
          {section === "Availability requests" && Array.isArray(data) && data.map((entry:Row)=><Card key={entry.id}>
            <Text style={styles.heading}>{entry.staffName}</Text>
            <Text style={styles.text}>{entry.startDate} to {entry.endDate} · {entry.startTime}–{entry.endTime}</Text>
            {!!entry.reason&&<Text style={styles.muted}>{entry.reason}</Text>}
            <Text style={styles.badge}>{entry.status}</Text>
            {entry.status==="PENDING"&&<View style={styles.row}><Button title="Approve" disabled={busy} onPress={()=>void decideAvailability(entry.id,"APPROVED")}/><Button title="Decline" variant="secondary" disabled={busy} onPress={()=>void decideAvailability(entry.id,"DECLINED")}/></View>}
          </Card>)}
          {section === "Availability requests" && Array.isArray(data) && data.length === 0 && <Empty text="No caregiver availability requests yet. Caregivers can submit one from My availability." />}
          {section === "Travel claims" && Array.isArray(data) && data.map((entry:Row)=><Card key={entry.id}>
            <Text style={styles.heading}>{entry.staffName} · {entry.clientName}</Text>
            <Text style={styles.text}>{entry.date} · {Number(entry.miles).toFixed(1)} miles · {entry.minutes} minutes</Text>
            {!!entry.note&&<Text style={styles.muted}>{entry.note}</Text>}
            <Text style={styles.badge}>{entry.status}</Text>
            {entry.status==="PENDING"&&<View style={styles.row}><Button disabled={busy} title="Approve" onPress={()=>void decideTravel(entry.id,"APPROVED")}/><Button disabled={busy} variant="secondary" title="Decline" onPress={()=>void decideTravel(entry.id,"DECLINED")}/></View>}
          </Card>)}
          {section === "Governance" && data && <>
            <Card><Text style={styles.heading}>Quality and safeguarding</Text>
              <Text style={styles.text}>{data.overview?.quality?.open||0} open cases · {data.overview?.quality?.overdue||0} overdue</Text>
              <Text style={styles.muted}>{data.overview?.credentials?.expiring||0} staff credentials expiring soon · {data.overview?.policies?.due||0} policy reviews due</Text>
            </Card>
            <Card><Text style={styles.heading}>Record a quality case</Text>
              <View style={styles.row}>{["INCIDENT","SAFEGUARDING","COMPLAINT","AUDIT_FINDING"].map(kind=><Button key={kind} variant="secondary" selected={caseKind===kind} title={kind.replaceAll("_"," ")} onPress={()=>setCaseKind(kind)}/>)}</View>
              <View style={styles.row}>{["LOW","MEDIUM","HIGH","CRITICAL"].map(level=><Button key={level} variant="secondary" selected={caseSeverity===level} title={level} onPress={()=>setCaseSeverity(level)}/>)}</View>
              <Text style={styles.muted}>Client (optional)</Text>
              <View style={styles.row}><Button variant="secondary" selected={!caseClientId} title="No client" onPress={()=>setCaseClientId(null)}/>{data.clients?.map((client:Row)=><Button key={client.id} variant="secondary" selected={caseClientId===client.id} title={`${client.firstName} ${client.lastName}`} onPress={()=>setCaseClientId(client.id)}/>)}</View>
              <Input label="Case title" value={caseTitle} onChangeText={setCaseTitle} maxLength={160}/>
              <Input label="What happened?" value={caseDescription} onChangeText={setCaseDescription} multiline maxLength={5000}/>
              <Button title="Record case" disabled={busy||caseTitle.trim().length<3||caseDescription.trim().length<10} onPress={()=>void createQualityCase()}/>
            </Card>
            <Text style={styles.heading}>Cases</Text>
            {data.cases?.map((item:Row)=><Card key={item.id}><Text style={styles.heading}>{item.title}</Text><Text style={styles.badge}>{item.kind} · {item.severity} · {item.status}</Text><Text style={styles.text}>{item.description}</Text>
              {item.status!=="CLOSED"&&<><Input label="Decision reason (at least 5 characters)" value={caseReason} onChangeText={setCaseReason} multiline maxLength={1000}/><View style={styles.row}>{["INVESTIGATING","ACTION_REQUIRED","CLOSED"].filter(status=>status!==item.status).map(status=><Button key={status} disabled={busy||caseReason.trim().length<5} variant="secondary" title={status.replaceAll("_"," ")} onPress={()=>void updateQualityCase(item.id,item.revision,status)}/>)}</View></>}
            </Card>)}
          </>}
          {section === "Platform" && data && <><Text style={styles.heading}>Organisations</Text>
            <Text style={styles.muted}>Manage registered businesses here. Your own organisation's clients remain in the Clients tab.</Text>
            {data.organisations?.map((organisation:Row)=><Card key={organisation.id}><Text style={styles.heading}>{organisation.name}</Text><Text style={styles.badge}>{organisation.status} · {organisation.country}</Text><Text style={styles.text}>{organisation.first_name} {organisation.last_name} · {organisation.email}</Text><Text style={styles.muted}>{organisation.review_notes||"No review notes"}</Text>
              {organisation.owner_id!==user.id&&<View style={styles.row}>{["ACTIVE","REJECTED","SUSPENDED"].filter(status=>status!==organisation.status).map(status=><Button key={status} variant="secondary" title={status==="ACTIVE"?"Approve / activate":status==="REJECTED"?"Reject":"Suspend"} onPress={()=>{setOrgDecisionId(organisation.id);setOrgDecisionStatus(status);setOrgDecisionNotes("")}}/>)}</View>}
            </Card>)}
            {!!orgDecisionId&&<Card><Text style={styles.heading}>Review organisation status</Text><Text style={styles.error}>{orgDecisionStatus==="SUSPENDED"?"Suspending disables this business's users.":orgDecisionStatus==="REJECTED"?"Rejecting disables this business's users.":"Activation grants this business access."}</Text><Input label="Review notes" value={orgDecisionNotes} onChangeText={setOrgDecisionNotes} multiline maxLength={2000}/><Button title="Confirm decision" disabled={busy||orgDecisionNotes.trim().length<5} onPress={()=>Alert.alert("Confirm business decision",`Change this organisation to ${orgDecisionStatus}?`,[{text:"Cancel",style:"cancel"},{text:"Confirm",onPress:()=>void decideOrganisation()}])}/><Button variant="secondary" title="Cancel" onPress={()=>setOrgDecisionId("")}/></Card>}
          </>}
          {section === "Reporting" && data && (
            <>
              {data.byStatus.map((s: Row) => (
                <Card key={s.status}>
                  <Text style={styles.heading}>
                    {s.status.replaceAll("_", " ")}
                  </Text>
                  <Text style={styles.text}>
                    {s.visits} visits · {(s.minutes / 60).toFixed(1)} scheduled
                    hours
                  </Text>
                </Card>
              ))}
              {!data.byStatus.length && (
                <Empty text="No visits to report this month." />
              )}
            </>
          )}
          {section === "Log" &&
            data?.entries?.map((e: Row) => (
              <Card key={e.id}>
                <Text style={styles.badge}>{e.actor}</Text>
                <Text style={styles.text}>
                  {e.path
                    .replace("/api/", "")
                    .split("/")
                    .filter((s: string) => !/[0-9a-f]{8}-/.test(s))
                    .join(" / ")}
                </Text>
                <Text style={styles.muted}>{timestamp(e.createdAt)}</Text>
              </Card>
            ))}
        </>
      )}
      {!section && <Card>
        <Text style={styles.heading}>Your session</Text>
        <Text style={styles.muted}>
          Sign out when using a shared device. The app needs an internet
          connection and does not store client records offline.
        </Text>
        <Button title="Sign out" onPress={logout} />
      </Card>}
    </ScrollView>
  );
}
