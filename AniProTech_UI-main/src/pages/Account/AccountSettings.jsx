import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Camera, MessageSquareText, ShieldCheck, UserRound, KeyRound, FileLock2, Hospital } from "lucide-react";
import { _get, _putForm } from "../../utils/ApiService";
import { showError, showSuccess } from "../../utils/toaster";
import useAuthStore from "../../stores/authStore";
import BusinessLocationFields from "../../components/Address/BusinessLocationFields";
import SecurityPanel from "./SecurityPanel";
import PrivacyPanel from "./PrivacyPanel";

const sections = [
  ["profile", "My profile", UserRound],
  ["security", "Security & devices", KeyRound],
  ["privacy", "Privacy & retention", FileLock2],
  ["organisation", "Organisation", Building2],
  ["nhs", "NHS identity & access", Hospital],
  ["support", "Help and support", ShieldCheck],
  ["carer-app", "Carer app settings", MessageSquareText],
  ["branding", "Branding", Camera],
];
const empty = {
  firstName:"",lastName:"",email:"",primaryPhone:"",organisationName:"",organisationPhone:"",legalName:"",
  businessType:"HOME_CARE",registrationNumber:"",website:"",addressLine1:"",addressLine2:"",
  city:"",state:"",postcode:"",country:"United Kingdom",countryCode:"GB",timezone:"Europe/London",supportEmail:"",
  supportPhone:"",carerAppMessage:"",allowPhotoUploads:true,requireLocationForCheckIn:true,
  allowVoiceNotes:true,notifyClientOnArrival:true,role:"",status:"ACTIVE",logoPath:"",
  nhsOdsCode:"",nhsOdsName:"",nhsOdsPublicationStatus:"NOT_CONFIGURED",nhsOdsPublishedAt:"",
};
const Input = ({ label, ...props }) => <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input {...props} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-customBlue focus:ring-2 focus:ring-customBlue/20" /></label>;
const Toggle = ({ label, checked, onChange, help }) => <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4"><span><span className="block font-medium text-slate-800">{label}</span><span className="text-sm text-slate-500">{help}</span></span><input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-5 w-5 accent-customBlue" /></label>;

export default function AccountSettings() {
  const [params, setParams] = useSearchParams();
  const active = params.get("section") || "profile";
  const [form,setForm]=useState(empty), [logo,setLogo]=useState(null), [loading,setLoading]=useState(true), [saving,setSaving]=useState(false);
  const { userData, setUserData } = useAuthStore();
  const canManage = ["ADMIN","SUPERADMIN"].includes(userData?.user?.role);
  const apiBase=(import.meta.env.VITE_APP_BASE_LIVE_URL||"https://backend.aniprotech.com").replace(/\/$/,"");
  const logoUrl=useMemo(()=>form.logoPath ? (/^https?:/.test(form.logoPath)?form.logoPath:`${apiBase}/${form.logoPath.replace(/^\//,"")}`):"",[form.logoPath,apiBase]);
  const change=(name,value)=>setForm((old)=>({...old,[name]:value}));
  useEffect(()=>{(async()=>{try{
    const response=await _get("/api/account"), data=response.data.results.data, u=data.user, o=data.organisation, settings=o.carer_app_settings||{};
    setForm({...empty,firstName:u.first_name,lastName:u.last_name,email:u.email,primaryPhone:u.primary_phone||"",role:u.role,
      organisationName:o.name,organisationPhone:o.phone||"",legalName:o.legal_name||"",businessType:o.business_type,registrationNumber:o.registration_number||"",
      website:o.website||"",addressLine1:o.address_line1,addressLine2:o.address_line2||"",city:o.city,postcode:o.postcode,
      state:o.state||"",country:o.country,timezone:o.timezone,status:o.status,supportEmail:o.support_email||"",supportPhone:o.support_phone||"",
      carerAppMessage:o.carer_app_message||"",logoPath:o.logo_path||"",nhsOdsCode:o.nhs_ods_code||"",nhsOdsName:o.nhs_ods_name||"",nhsOdsPublicationStatus:o.nhs_ods_publication_status||"NOT_CONFIGURED",nhsOdsPublishedAt:o.nhs_ods_published_at?String(o.nhs_ods_published_at).slice(0,10):"",...settings});
  }catch(e){showError(e.response?.data?.message||"Unable to load account settings");}finally{setLoading(false);}})();},[]);
  const submit=async(e)=>{e.preventDefault();setSaving(true);try{
    const body=new FormData();
    Object.entries(form).forEach(([key,val])=>{if(!["logoPath","role","status","countryCode","stateCode","allowPhotoUploads","requireLocationForCheckIn","allowVoiceNotes","notifyClientOnArrival"].includes(key))body.append(key,val??"");});
    body.append("carerAppSettings",JSON.stringify({allowPhotoUploads:form.allowPhotoUploads,requireLocationForCheckIn:form.requireLocationForCheckIn,allowVoiceNotes:form.allowVoiceNotes,notifyClientOnArrival:form.notifyClientOnArrival}));
    if(logo) body.append("logo",logo);
    const response=await _putForm("/api/account",body), data=response.data.results.data, u=data.user, o=data.organisation;
    setUserData({...userData,user:{...userData.user,firstName:u.first_name,lastName:u.last_name,email:u.email,primaryPhone:u.primary_phone},organisation:{name:o.name,logoPath:o.logo_path||""}});
    change("logoPath",o.logo_path||""); setLogo(null); showSuccess("Account settings updated");
  }catch(err){showError(err.response?.data?.message||"Unable to save account settings");}finally{setSaving(false);}};
  if(loading) return <div className="p-10 text-slate-600">Loading account settings…</div>;
  if(!canManage) return <div className="p-10"><h1 className="text-2xl font-semibold">Administrator access required</h1></div>;
  return <div className="min-h-[calc(100vh-64px)] bg-slate-50"><div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <div className="mb-6"><h1 className="text-3xl font-semibold text-slate-900">Account settings</h1><p className="mt-1 text-slate-500">Manage your administrator profile and organisation settings.</p></div>
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]"><aside className="h-fit rounded-xl border bg-white p-2 shadow-sm">{sections.map(([id,label,Icon])=><button key={id} type="button" onClick={()=>setParams({section:id})} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${active===id?"bg-blue-50 font-semibold text-customTextNavy":"text-slate-600 hover:bg-slate-50"}`}><Icon size={18}/>{label}</button>)}</aside>
      <form onSubmit={submit} className="rounded-xl border bg-white p-6 shadow-sm">
        {active==="security"&&<SecurityPanel/>}
        {active==="privacy"&&<PrivacyPanel/>}
        {active==="profile"&&<><h2 className="mb-5 text-xl font-semibold">Administrator profile</h2><div className="grid gap-4 md:grid-cols-2"><Input label="First name" value={form.firstName} onChange={e=>change("firstName",e.target.value)} required/><Input label="Last name" value={form.lastName} onChange={e=>change("lastName",e.target.value)} required/><Input label="Email" type="email" value={form.email} onChange={e=>change("email",e.target.value)} required/><Input label="Phone" value={form.primaryPhone} onChange={e=>change("primaryPhone",e.target.value)}/><Input label="Role" value={form.role} disabled/><Input label="Account status" value={form.status} disabled/></div></>}
        {active==="organisation"&&<><h2 className="mb-5 text-xl font-semibold">Organisation details</h2><div className="grid gap-4 md:grid-cols-2"><Input label="Organisation name" value={form.organisationName} onChange={e=>change("organisationName",e.target.value)} required/><Input label="Organisation phone" value={form.organisationPhone} onChange={e=>change("organisationPhone",e.target.value)} required/><Input label="Legal name" value={form.legalName} onChange={e=>change("legalName",e.target.value)}/><label className="block"><span className="mb-1 block text-sm font-medium">Business type</span><select value={form.businessType} onChange={e=>change("businessType",e.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="HOME_CARE">Home care</option><option value="LIVE_IN_CARE">Live-in care</option><option value="SUPPORTED_LIVING">Supported living</option><option value="CARE_HOME">Care home</option><option value="OTHER">Other</option></select></label><Input label="Registration number" value={form.registrationNumber} onChange={e=>change("registrationNumber",e.target.value)}/><Input label="Website" type="url" value={form.website} onChange={e=>change("website",e.target.value)}/><Input label="Address line 1" value={form.addressLine1} onChange={e=>change("addressLine1",e.target.value)} required/><Input label="Address line 2" value={form.addressLine2} onChange={e=>change("addressLine2",e.target.value)}/><BusinessLocationFields form={form} setForm={setForm}/></div></>}
        {active==="nhs"&&<><h2 className="mb-2 text-xl font-semibold">NHS organisation identity and access</h2><p className="mb-5 text-sm text-slate-600">Record the ODS identity for this organisation. An ODS code supports organisation-directory lookup; it does not itself grant access to patient records, GP Connect or EPS.</p><div className="grid gap-4 md:grid-cols-2"><Input label="ODS code" value={form.nhsOdsCode} maxLength="5" onChange={e=>change("nhsOdsCode",e.target.value.toUpperCase())}/><Input label="ODS organisation name" value={form.nhsOdsName} onChange={e=>change("nhsOdsName",e.target.value)}/><label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Publication status</span><select value={form.nhsOdsPublicationStatus} onChange={e=>change("nhsOdsPublicationStatus",e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="ACTIVE_PENDING_PUBLICATION">Active — awaiting ODS API/DSE publication</option><option value="PUBLISHED">Published — verified in ODS API or DSE</option><option value="UNVERIFIED">Needs verification</option><option value="NOT_CONFIGURED">Not configured</option></select></label><Input label="Published/verified date" type="date" value={form.nhsOdsPublishedAt} onChange={e=>change("nhsOdsPublishedAt",e.target.value)}/></div><div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p><b>Organisation directory lookups:</b> available for GP practices, hospitals and pharmacies using the configured ODS source or public fallback.</p><p><b>dm+d medicine suggestions:</b> require terminology credentials in the production environment.</p><p><b>Patient registered GP/nominated pharmacy and GP records:</b> remain disabled until PDS and GP Connect onboarding, legal basis and credentials are approved.</p></div></>}
        {active==="support"&&<><h2 className="mb-2 text-xl font-semibold">Help and support</h2><p className="mb-5 text-sm text-slate-500">These details are shown to carers who need assistance.</p><div className="grid gap-4 md:grid-cols-2"><Input label="Support email" type="email" value={form.supportEmail} onChange={e=>change("supportEmail",e.target.value)}/><Input label="Support phone" value={form.supportPhone} onChange={e=>change("supportPhone",e.target.value)}/></div></>}
        {active==="carer-app"&&<><h2 className="mb-5 text-xl font-semibold">Carer app settings</h2><label className="mb-5 block"><span className="mb-1 block text-sm font-medium">Message shown to carers</span><textarea rows="5" maxLength="1000" value={form.carerAppMessage} onChange={e=>change("carerAppMessage",e.target.value)} className="w-full rounded-lg border px-3 py-2"/><span className="text-xs text-slate-400">{form.carerAppMessage.length}/1000</span></label><div className="space-y-3"><Toggle label="Photo uploads" help="Allow carers to attach visit photos." checked={form.allowPhotoUploads} onChange={e=>change("allowPhotoUploads",e.target.checked)}/><Toggle label="Location required for check-in" help="Require device location when starting a visit." checked={form.requireLocationForCheckIn} onChange={e=>change("requireLocationForCheckIn",e.target.checked)}/><Toggle label="Voice notes" help="Allow voice recording and speech-to-text notes." checked={form.allowVoiceNotes} onChange={e=>change("allowVoiceNotes",e.target.checked)}/><Toggle label="Arrival notifications" help="Notify the office and client when a carer arrives nearby." checked={form.notifyClientOnArrival} onChange={e=>change("notifyClientOnArrival",e.target.checked)}/></div></>}
        {active==="branding"&&<><h2 className="mb-2 text-xl font-semibold">Organisation branding</h2><p className="mb-5 text-sm text-slate-500">Upload a square PNG or JPEG logo. Maximum file size is 12 MB.</p><div className="flex items-center gap-5">{logoUrl?<img src={logoUrl} alt="Organisation logo" className="h-24 w-24 rounded-xl border object-contain p-2"/>:<div className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100 text-3xl font-semibold text-slate-500">{form.organisationName.slice(0,1)}</div>}<input type="file" accept="image/png,image/jpeg" onChange={e=>setLogo(e.target.files?.[0]||null)}/></div></>}
        {!['security','privacy'].includes(active)&&<div className="mt-8 flex justify-end border-t pt-5"><button disabled={saving} className="rounded-lg bg-customTextNavy px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Save changes"}</button></div>}
      </form></div></div></div>;
}
