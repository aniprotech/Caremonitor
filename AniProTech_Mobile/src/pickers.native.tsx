import React, { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button, Input, styles } from "./ui";

type PickerProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  optional?: boolean;
  minDate?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");
const formatDate = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const formatTime = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}`;
const ukDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "";

function selectedDate(value: string, mode: "date" | "time") {
  const selected = new Date();
  if (mode === "date") selected.setHours(0, 0, 0, 0);
  if (mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    selected.setFullYear(year, month - 1, day);
  } else if (mode === "time" && /^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(":").map(Number);
    selected.setHours(hour, minute, 0, 0);
  }
  return selected;
}

function PickerField({ label, value, onChangeText, optional, minDate, mode }: PickerProps & { mode: "date" | "time" }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => selectedDate(value, mode));
  const minimumDate = minDate ? selectedDate(minDate, "date") : undefined;
  const choose = () => {
    const current = selectedDate(value, mode);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: true,
        ...(mode === "date" ? { minimumDate } : {}),
        onChange: (event, selected) => {
          if (event.type === "set" && selected) onChangeText(mode === "date" ? formatDate(selected) : formatTime(selected));
        },
      });
    } else {
      setDraft(current);
      setVisible(true);
    }
  };
  return <View style={{ gap: 5 }}>
    <Text style={styles.muted}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label}`} onPress={choose} style={[styles.input, { flex: 1 }]}>
        <Text style={styles.text}>{mode === "date" ? (ukDate(value) || "DD/MM/YYYY") : (value || "Choose time")} ▾</Text>
      </Pressable>
      {optional && !!value && <Button title="Clear" variant="secondary" onPress={() => onChangeText("")} />}
    </View>
    {mode === "time" && <Input label={`Or type ${label} (HH:MM)`} value={value} onChangeText={onChangeText} keyboardType="numbers-and-punctuation" maxLength={5}/>}
    {Platform.OS === "ios" && <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0008" }}>
        <View style={{ backgroundColor: "white", padding: 20, gap: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
          <Text style={styles.heading}>{label}</Text>
          <DateTimePicker value={draft} mode={mode} display="spinner" minimumDate={mode === "date" ? minimumDate : undefined} onChange={(_event, selected) => { if (selected) setDraft(selected); }} />
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" onPress={() => setVisible(false)} />
            <Button title="Done" onPress={() => { onChangeText(mode === "date" ? formatDate(draft) : formatTime(draft)); setVisible(false); }} />
          </View>
        </View>
      </View>
    </Modal>}
  </View>;
}

export function DateInput(props: PickerProps) { return <PickerField {...props} mode="date" />; }
export function TimeInput(props: PickerProps) { return <PickerField {...props} mode="time" />; }
