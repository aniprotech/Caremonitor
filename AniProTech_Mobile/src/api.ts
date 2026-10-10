import * as SecureStore from "expo-secure-store";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { Base64 } from "js-base64";
import { Platform } from "react-native";
import { replayOwnedQueue } from "./offlineQueue.js";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8080"
).replace(/\/$/, "");
export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  primaryPhone?: string | null;
};
export type Api = <T = any>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
export class ApiRequestError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}
let token: string | null = null;
let unauthorized: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorized = handler;
}

const key = "aniprotech.session";
const localBrowserPreview = Platform.OS === "web" && __DEV__ && typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(API_URL);
export async function saveToken(value: string | null) {
  token = value;
  if (Platform.OS === "web") {
    if (localBrowserPreview) {
      if (value) window.sessionStorage.setItem(key, JSON.stringify({ token: value, origin: API_URL }));
      else window.sessionStorage.removeItem(key);
    }
    return;
  }
  if (value)
    await SecureStore.setItemAsync(
      key,
      JSON.stringify({ token: value, origin: API_URL }),
    );
  else await SecureStore.deleteItemAsync(key);
}
export async function restoreToken() {
  if (Platform.OS === "web" && !localBrowserPreview) return null;
  const stored = Platform.OS === "web" ? window.sessionStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed.origin !== API_URL) {
      if (Platform.OS === "web") window.sessionStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
      return null;
    }
    token = parsed.token;
    return token;
  } catch {
    if (Platform.OS === "web") window.sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
    return null;
  }
}
export const api: Api = async (path, method = "GET", body) => {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(API_URL + path, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (
      response.status === 401 &&
      !path.includes("/auth/get-token") &&
      !path.includes("/auth/request-link")
    )
      unauthorized?.();
    if (!response.ok || result.error)
      throw new ApiRequestError(result.message || "Request failed", response.status);
    return result.results?.data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new ApiRequestError(
        "The server took too long. Check your connection and retry.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

export type PendingMutation = { id: string; ownerId: string; path: string; body: unknown; label: string; queuedAt: string; sequence?: number; attempts: number; lastError: string };
export type SyncSummary = { pending: number; blocked: number; sent: number; lastSyncAt: string | null; items: Pick<PendingMutation,"id"|"label"|"queuedAt"|"attempts"|"lastError">[] };
const queueKey = "caremonitor.pending-mutations";
const syncKey = (ownerId: string) => `caremonitor.sync-summary.${ownerId}`;
const offlineKeyName = "caremonitor.offline-file-key-v2";
let offlineDirectory!: Directory;
if (Platform.OS !== "web") offlineDirectory = new Directory(Paths.document, "caremonitor-offline-v2");
let encryptionKeyPromise: Promise<AESEncryptionKey> | null = null;
let queueOperation: Promise<unknown> = Promise.resolve();
function queueLock<T>(work: () => Promise<T>): Promise<T> {
  const result = queueOperation.then(work, work);
  queueOperation = result.catch(() => {});
  return result;
}
function recordFile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid offline record identifier");
  return new File(offlineDirectory, `${id}.care`);
}
function photoFile(id: string) { return new File(offlineDirectory, `${id}.photo`); }
function formDraftFile(scope: string) {
  if (!/^[a-z0-9-]{1,120}$/i.test(scope)) throw new Error("Invalid form draft identifier");
  return new File(offlineDirectory, `draft-${scope}.care`);
}
async function offlineKey(): Promise<AESEncryptionKey> {
  if (!encryptionKeyPromise) encryptionKeyPromise = (async () => {
    const stored = await SecureStore.getItemAsync(offlineKeyName);
    if (stored) return AESEncryptionKey.import(stored, "hex");
    if (offlineDirectory.exists && offlineDirectory.list().some((entry) => entry instanceof File && /\.(care|photo)$/.test(entry.name)))
      throw new Error("Encrypted care records are present but their device key is unavailable. Do not uninstall the app; contact support.");
    const generated = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(offlineKeyName, await generated.encoded("hex"));
    return generated;
  })().catch(error => { encryptionKeyPromise = null; throw error; });
  return encryptionKeyPromise;
}
async function encryptRecord(item: PendingMutation): Promise<Uint8Array> {
  const sealed = await aesEncryptAsync(Base64.encode(JSON.stringify(item)), await offlineKey());
  return sealed.combined();
}
async function decryptRecord(file: File): Promise<PendingMutation> {
  const encoded = await aesDecryptAsync(AESSealedData.fromCombined(await file.bytes()), await offlineKey(), { output: "base64" });
  const item: unknown = JSON.parse(Base64.decode(encoded));
  if (!item || typeof item !== "object" || typeof (item as PendingMutation).id !== "string" ||
      typeof (item as PendingMutation).ownerId !== "string" || typeof (item as PendingMutation).path !== "string")
    throw new Error("An offline care record is invalid. Do not sign out; contact support.");
  return item as PendingMutation;
}
/** Device-bound encrypted storage for unfinished forms. Drafts are local only. */
export async function saveFormDraft(scope: string, draft: unknown) {
  if (Platform.OS === "web") return;
  const raw = JSON.stringify(draft);
  if (raw.length > 100_000) throw new Error("This unfinished form is too large to store safely on this device.");
  offlineDirectory.create({ idempotent: true, intermediates: true });
  const target = formDraftFile(scope);
  const temporary = new File(offlineDirectory, `draft-${scope}.tmp`);
  temporary.create({ overwrite: true });
  try {
    const sealed = await aesEncryptAsync(Base64.encode(raw), await offlineKey());
    temporary.write(await sealed.combined());
    await temporary.move(target, { overwrite: true });
  } finally { if (temporary.exists) temporary.delete(); }
}
export async function restoreFormDraft<T>(scope: string): Promise<T | null> {
  if (Platform.OS === "web") return null;
  const file = formDraftFile(scope);
  if (!file.exists) return null;
  try {
    const raw = await aesDecryptAsync(AESSealedData.fromCombined(await file.bytes()), await offlineKey(), { output: "base64" });
    return JSON.parse(Base64.decode(raw)) as T;
  } catch {
    if (file.exists) file.delete();
    return null;
  }
}
export async function clearFormDraft(scope: string) {
  if (Platform.OS === "web") return;
  const file = formDraftFile(scope);
  if (file.exists) file.delete();
}
export async function clearAllFormDrafts() {
  if (Platform.OS === "web" || !offlineDirectory.exists) return;
  for (const file of offlineDirectory.list())
    if (file instanceof File && /^draft-[a-z0-9-]{1,120}\.care$/i.test(file.name)) file.delete();
}
async function saveRecord(item: PendingMutation) {
  offlineDirectory.create({ idempotent: true, intermediates: true });
  const temporary = new File(offlineDirectory, `${item.id}.tmp`);
  temporary.create({ overwrite: true });
  try {
    temporary.write(await encryptRecord(item));
    await temporary.move(recordFile(item.id), { overwrite: true });
  } finally { if (temporary.exists) temporary.delete(); }
}
async function saveEncryptedPhoto(id: string, asset: UploadAsset) {
  offlineDirectory.create({ idempotent: true, intermediates: true });
  const source = new File(asset.uri);
  if (source.size > 12 * 1024 * 1024) throw new Error("The photo is larger than 12 MB. Retake it at a lower resolution.");
  const storedBytes = offlineDirectory.list()
    .filter((entry): entry is File => entry instanceof File && entry.name.endsWith(".photo"))
    .reduce((total, file) => total + file.size, 0);
  if (storedBytes + source.size > 100 * 1024 * 1024)
    throw new Error("Offline photos are using too much device storage. Reconnect and synchronise before adding more evidence.");
  const bytes = await source.bytes();
  if (bytes.length > 12 * 1024 * 1024) throw new Error("The photo is larger than 12 MB. Retake it at a lower resolution.");
  const sealed = await aesEncryptAsync(bytes, await offlineKey());
  const temporary = new File(offlineDirectory, `${id}.photo-tmp`);
  temporary.create({ overwrite: true });
  try {
    temporary.write(await sealed.combined());
    await temporary.move(photoFile(id), { overwrite: true });
  } finally { if (temporary.exists) temporary.delete(); }
}
async function uploadQueuedPhoto(item: PendingMutation) {
  const body = item.body as QueuedPhoto;
  const encrypted = photoFile(item.id);
  if (!encrypted.exists) throw new Error("The saved photo is missing from this device. Contact your administrator.");
  const bytes = await aesDecryptAsync(AESSealedData.fromCombined(await encrypted.bytes()), await offlineKey());
  const suffix = body.asset.mimeType === "image/png" ? "png" : body.asset.mimeType?.includes("hei") ? "heic" : "jpg";
  const temporary = new File(Paths.cache, `caremonitor-retry-${item.id}.${suffix}`);
  temporary.create({ overwrite: true });
  try {
    temporary.write(bytes);
    await upload(item.path, { ...body.asset, uri: temporary.uri }, body.caption, body.metadata, item.id);
  } finally { if (temporary.exists) temporary.delete(); }
}
async function migrateLegacyQueue() {
  const stored = await SecureStore.getItemAsync(queueKey);
  if (!stored) return;
  let items: unknown;
  try { items = JSON.parse(stored); } catch { throw new Error("The previous offline care queue is unreadable. Do not sign out; contact support."); }
  if (!Array.isArray(items)) throw new Error("The previous offline care queue is invalid. Do not sign out; contact support.");
  for (const [index,item] of (items as PendingMutation[]).entries()) {
    if (!recordFile(item.id).exists) await saveRecord({ ...item, sequence:index + 1 });
  }
  await SecureStore.deleteItemAsync(queueKey);
}
function removeInterruptedPhotoUploads() {
  if (!Paths.cache.exists) return;
  for (const entry of Paths.cache.list()) {
    if (entry instanceof File && /^caremonitor-retry-[0-9a-f-]{36}\.(jpg|png|heic)$/i.test(entry.name))
      entry.delete();
  }
}
export function clientEventId() {
  return randomUUID();
}
async function readQueue(): Promise<PendingMutation[]> {
  if (Platform.OS === "web") return [];
  removeInterruptedPhotoUploads();
  await migrateLegacyQueue();
  if (!offlineDirectory.exists) return [];
  const files = offlineDirectory.list().filter((entry): entry is File => entry instanceof File && entry.name.endsWith(".care"));
  const records = await Promise.all(files.map(decryptRecord));
  return records.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || (a.sequence || 0) - (b.sequence || 0));
}
async function writeQueue(items: PendingMutation[]) {
  if (Platform.OS === "web") return;
  if (!offlineDirectory.exists && !items.length) return;
  offlineDirectory.create({ idempotent: true, intermediates: true });
  for (const item of items) await saveRecord(item);
  const retained = new Set(items.map((item) => `${item.id}.care`));
  for (const file of offlineDirectory.list())
    if (file instanceof File && file.name.endsWith(".care") && !retained.has(file.name)) file.delete();
  for (const file of offlineDirectory.list())
    if (file instanceof File && file.name.endsWith(".photo") && !retained.has(file.name.replace(/\.photo$/, ".care"))) file.delete();
}
export async function clearPendingMutations(ownerId: string) {
  if (Platform.OS === "web") return;
  await queueLock(async () => {
    const remaining = (await readQueue()).filter((item) => item.ownerId !== ownerId);
    await writeQueue(remaining);
    await SecureStore.deleteItemAsync(syncKey(ownerId));
  });
}
export async function pendingMutationSummary(ownerId: string): Promise<SyncSummary> {
  const items=(await queueLock(readQueue)).filter((item)=>item.ownerId===ownerId);
  let lastSyncAt:string|null=null,sent=0;
  if(Platform.OS!=="web")try{const stored=await SecureStore.getItemAsync(syncKey(ownerId));if(stored){const parsed=JSON.parse(stored);lastSyncAt=parsed.lastSyncAt||null;sent=Number(parsed.sent||0);}}catch{}
  return {pending:items.length,blocked:items.filter((item)=>!!item.lastError).length,sent,lastSyncAt,items:items.map(({id,label,queuedAt,attempts,lastError})=>({id,label,queuedAt,attempts,lastError}))};
}
export async function apiOrQueue(path: string, body: unknown, ownerId: string, label = "Visit record") {
  if (Platform.OS === "web") return { data: await api(path, "POST", body), queued: false };
  return queueLock(async () => {
    const items = await readQueue();
    if (!items.some((item) => item.ownerId === ownerId)) {
      try { return { data: await api(path, "POST", body), queued: false }; }
      catch (error) {
        if (error instanceof ApiRequestError && error.status !== null && error.status < 500) throw error;
      }
    }
    const id = (body as any)?.clientEventId;
    if (!id) throw new Error("Offline record identifier is missing.");
    if (items.length >= 100) throw new Error("The secure offline queue is full. Reconnect before recording more visit information.");
    if (!items.some((item) => item.id === id)) items.push({ id, ownerId, path, body, label, queuedAt: new Date().toISOString(), sequence:Math.max(0,...items.map(item=>item.sequence||0))+1, attempts:0, lastError:"" });
    await writeQueue(items);
    return { data: null, queued: true };
  });
}
export async function flushPendingMutations(ownerId: string) {
  return queueLock(async () => {
    const items = await readQueue();
    const {remaining,sent}=await replayOwnedQueue(items,ownerId,(item)=>(item.body as QueuedPhoto)?.type === "PHOTO" ? uploadQueuedPhoto(item) : api(item.path,"POST",item.body),(error)=>error instanceof ApiRequestError&&error.status!==null&&error.status<500?(error as Error).message:"Waiting for a network connection");
    await writeQueue(remaining);
    const owned=remaining.filter((item)=>item.ownerId===ownerId),summary={sent,pending:owned.length,blocked:owned.filter((item)=>!!item.lastError).length,lastSyncAt:new Date().toISOString()};
    if(Platform.OS!=="web")await SecureStore.setItemAsync(syncKey(ownerId),JSON.stringify(summary));
    return summary;
  });
}

export type UploadAsset = { uri:string; fileName?:string|null; mimeType?:string|null; fileSize?:number|null };
type PhotoMetadata = { latitude:number|null; longitude:number|null; accuracy:number|null; capturedAt:string|null };
type QueuedPhoto = { type:"PHOTO"; asset:UploadAsset; caption:string; metadata:PhotoMetadata };
export async function uploadOrQueuePhoto(path:string, asset:UploadAsset, caption:string, metadata:PhotoMetadata, ownerId:string) {
  const id = clientEventId();
  if (Platform.OS === "web") return { data:await upload(path,asset,caption,metadata,id),queued:false };
  return queueLock(async () => {
    const items = await readQueue();
    if (!items.some(item => item.ownerId === ownerId)) {
      try { return { data:await upload(path,asset,caption,metadata,id),queued:false }; }
      catch (error) {
        if (error instanceof ApiRequestError && error.status !== null && error.status < 500) throw error;
      }
    }
    if (items.length >= 100) throw new Error("The secure offline queue is full. Reconnect before adding more evidence.");
    await saveEncryptedPhoto(id,asset);
    const body:QueuedPhoto={type:"PHOTO",asset:{fileName:asset.fileName,mimeType:asset.mimeType,fileSize:asset.fileSize,uri:""},caption,metadata};
    items.push({id,ownerId,path,body,label:"Visit photo evidence",queuedAt:new Date().toISOString(),sequence:Math.max(0,...items.map(item=>item.sequence||0))+1,attempts:0,lastError:""});
    await writeQueue(items);
    return { data:null,queued:true };
  });
}
export async function upload(path: string, asset: UploadAsset, caption = "", metadata?: PhotoMetadata, clientEventId?:string) {
  if(asset.fileSize && asset.fileSize > 12 * 1024 * 1024)
    throw new Error("The photo is larger than 12 MB. Retake it at a lower resolution.");
  const form = new FormData();
  form.append("caption", caption);
  if(clientEventId)form.append("clientEventId",clientEventId);
  if(metadata){
    if(metadata.latitude!=null)form.append("latitude",String(metadata.latitude));
    if(metadata.longitude!=null)form.append("longitude",String(metadata.longitude));
    if(metadata.accuracy!=null)form.append("accuracy",String(metadata.accuracy));
    if(metadata.capturedAt)form.append("capturedAt",metadata.capturedAt);
  }
  const inferredExtension=asset.mimeType==="image/png"?"png":asset.mimeType?.includes("hei")?"heic":"jpg";
  form.append("photo", { uri:asset.uri, name:asset.fileName||`care-photo-${Date.now()}.${inferredExtension}`, type:asset.mimeType||"image/jpeg" } as any);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
    const response = await fetch(API_URL + path, {
      method: "POST",
      signal:controller.signal,
      headers: token ? { Authorization: "Bearer " + token } : {},
      body: form,
    });
    const raw=await response.text();
    let result:any={};
    try{result=raw?JSON.parse(raw):{}}catch{throw new Error(`Photo upload failed (${response.status}). Please retry.`)}
    if(response.status===401)unauthorized?.();
    if (!response.ok || result.error) throw new ApiRequestError(result.message || "Photo upload failed",response.status);
    return result.results?.data;
  }catch(error){
    if(error instanceof Error&&error.name==="AbortError")throw new Error("The photo upload took too long. Check your connection and retry.");
    throw error;
  }finally{clearTimeout(timer)}
}
