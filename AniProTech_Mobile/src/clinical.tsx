import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api } from "./api";
import { Button, Card, Input, styles } from "./ui";

type Term = { name: string; source: string; postcode?: string };
type Kind = "history" | "hospital" | "medicine";

export function validNhsNumber(value: string) {
  if (!value.trim()) return "";
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return null;
  const total = [...digits.slice(0, 9)].reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0);
  const result = 11 - total % 11;
  const check = result === 11 ? 0 : result;
  return check !== 10 && check === Number(digits[9]) ? digits : null;
}

export function ClinicalTermPicker({ kind, label, onSelect }: { kind: Kind; label: string; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<Term[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api<{ terms: Term[] }>(`/api/clinical-catalog?kind=${kind}&q=${encodeURIComponent(query)}`)
        .then(result => { if (active) setTerms(result.terms || []); })
        .catch(() => { if (active) setTerms([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, query]);
  const select = (name: string) => { onSelect(name); setQuery(""); setError(""); };
  async function add() {
    if (query.trim().length < 2) return setError("Enter at least two characters.");
    setBusy(true);
    try { const result = await api<{ name: string }>("/api/clinical-catalog", "POST", { kind, name: query.trim() }); select(result.name); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 6 }}>
    <Input label={label} value={query} onChangeText={setQuery} maxLength={120}/>
    {!!query && terms.map(term => <Button key={`${term.source}-${term.name}-${term.postcode || ""}`} variant="secondary" title={`${term.name}${term.postcode ? ` (${term.postcode})` : ""} · ${term.source}`} onPress={() => select(term.name)}/>)}
    {!!query.trim() && !terms.some(term => term.name.toLowerCase() === query.trim().toLowerCase()) && <Button disabled={busy} variant="secondary" title={`+ Add ${query.trim()} for this organisation`} onPress={() => void add()}/>}
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>;
}

export function ClinicalProfileEditor({ clientId, info, onSaved }: { clientId: string; info: Record<string, any>; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [nhs, setNhs] = useState(String(info.nhsNumber || ""));
  const [hospital, setHospital] = useState(String(info.hospitalName || ""));
  const [history, setHistory] = useState<string[]>(Array.isArray(info.medicalHistory) ? info.medicalHistory : []);
  const [allergies, setAllergies] = useState(String(info.allergiesIntolerances || ""));
  const [medicalSupport, setMedicalSupport] = useState(Boolean(info.medicalSupport));
  const [gpPractice, setGpPractice] = useState(String(info.gpPracticeName || ""));
  const [gpPracticeIdentifier, setGpPracticeIdentifier] = useState(String(info.gpPracticeIdentifier || ""));
  const [gpName, setGpName] = useState(String(info.gpName || ""));
  const [gpPhone, setGpPhone] = useState(String(info.gpPhoneNumber || ""));
  const [pharmacy, setPharmacy] = useState(String(info.pharmacyName || ""));
  const [pharmacyPhone, setPharmacyPhone] = useState(String(info.pharmacyPhoneNumber || ""));
  const [pharmacyAddress, setPharmacyAddress] = useState(String(info.pharmacyAddress || ""));
  const [pharmacyPostCode, setPharmacyPostCode] = useState(String(info.pharmacyPostCode || ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNhs(String(info.nhsNumber || "")); setHospital(String(info.hospitalName || "")); setHistory(Array.isArray(info.medicalHistory) ? info.medicalHistory : []); setAllergies(String(info.allergiesIntolerances || "")); setMedicalSupport(Boolean(info.medicalSupport)); setGpPractice(String(info.gpPracticeName || "")); setGpPracticeIdentifier(String(info.gpPracticeIdentifier || "")); setGpName(String(info.gpName || "")); setGpPhone(String(info.gpPhoneNumber || "")); setPharmacy(String(info.pharmacyName || "")); setPharmacyPhone(String(info.pharmacyPhoneNumber || "")); setPharmacyAddress(String(info.pharmacyAddress || "")); setPharmacyPostCode(String(info.pharmacyPostCode || "")); }, [info]);
  async function save() {
    const number = validNhsNumber(nhs);
    if (number === null) return setError("Enter a valid 10-digit NHS number with a correct check digit, or leave it blank.");
    setBusy(true); setError("");
    try { await api(`/api/client-information/update/${clientId}`, "POST", { nhsNumber: number || null, hospitalName: hospital, medicalHistory: history, medicalSupport, allergiesIntolerances: allergies, gpPracticeName: gpPractice, gpPracticeIdentifier, gpName, gpPhoneNumber: gpPhone, pharmacyName: pharmacy, pharmacyPhoneNumber: pharmacyPhone, pharmacyAddress, pharmacyPostCode }); setEditing(false); onSaved(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Card>
    <Text style={styles.heading}>Clinical details</Text>
    {!editing ? <Button title="Edit clinical details" variant="secondary" onPress={() => setEditing(true)}/> : <>
      <Input label="NHS number" value={nhs} onChangeText={setNhs} keyboardType="number-pad" maxLength={14}/>
      <Text style={styles.muted}>The format and check digit are checked. Confirm the number belongs to this client against an NHS record.</Text>
      <Text style={styles.text}>Hospital: {hospital || "Not recorded"}</Text>
      <ClinicalTermPicker kind="hospital" label="Search hospitals" onSelect={setHospital}/>
      <Text style={styles.text}>Medical history: {history.join(", ") || "Not recorded"}</Text>
      <ClinicalTermPicker kind="history" label="Search medical history" onSelect={name => setHistory(current => current.some(item => item.toLowerCase() === name.toLowerCase()) ? current : [...current, name])}/>
      {history.map(item => <Button key={item} variant="secondary" title={`Remove ${item}`} onPress={() => setHistory(current => current.filter(value => value !== item))}/>)}
      <Input label="Allergies and intolerances" value={allergies} onChangeText={setAllergies} multiline maxLength={2000}/>
      <Button title={`${medicalSupport ? "✓ " : ""}Medical support required`} variant="secondary" selected={medicalSupport} onPress={() => setMedicalSupport(value => !value)}/>
      <Input label="GP practice" value={gpPractice} onChangeText={setGpPractice} maxLength={120}/>
      <Input label="GP practice identifier" value={gpPracticeIdentifier} onChangeText={setGpPracticeIdentifier} maxLength={120}/>
      <Input label="GP name" value={gpName} onChangeText={setGpName} maxLength={120}/>
      <Input label="GP phone" value={gpPhone} onChangeText={setGpPhone} keyboardType="phone-pad" maxLength={30}/>
      <Input label="Pharmacy" value={pharmacy} onChangeText={setPharmacy} maxLength={120}/>
      <Input label="Pharmacy phone" value={pharmacyPhone} onChangeText={setPharmacyPhone} keyboardType="phone-pad" maxLength={30}/>
      <Input label="Pharmacy address" value={pharmacyAddress} onChangeText={setPharmacyAddress} maxLength={300}/>
      <Input label="Pharmacy postcode" value={pharmacyPostCode} onChangeText={setPharmacyPostCode} maxLength={20}/>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}><Button title="Cancel" variant="secondary" onPress={() => setEditing(false)}/><Button title={busy ? "Saving…" : "Save clinical details"} disabled={busy} onPress={() => void save()}/></View>
    </>}
  </Card>;
}
