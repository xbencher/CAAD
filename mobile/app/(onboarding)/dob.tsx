import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { setDob } from "../../src/api/auth";
import { normalizeError } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";

export function validateDobFields(
  dayStr: string,
  monthStr: string,
  yearStr: string
): { isValid: boolean; error: string | null; isoDate: string | null } {
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (!dayStr || !monthStr || !yearStr || isNaN(day) || isNaN(month) || isNaN(year)) {
    return { isValid: false, error: "Please enter your complete date of birth.", isoDate: null };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: "Invalid month.", isoDate: null };
  }

  if (day < 1 || day > 31) {
    return { isValid: false, error: "Invalid day.", isoDate: null };
  }

  const currentYear = new Date().getFullYear();
  if (year < 1920 || year > currentYear) {
    return { isValid: false, error: "Invalid year.", isoDate: null };
  }

  // Construct ISO date YYYY-MM-DD
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsedDate = new Date(isoDate);

  if (isNaN(parsedDate.getTime())) {
    return { isValid: false, error: "Invalid calendar date.", isoDate: null };
  }

  return { isValid: true, error: null, isoDate };
}

export default function DobScreen(): React.JSX.Element {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnder18Blocked, setIsUnder18Blocked] = useState(false);

  const { fetchUser, logout } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async () => {
    setError(null);
    const { isValid, error: valError, isoDate } = validateDobFields(day, month, year);

    if (!isValid || !isoDate) {
      setError(valError ?? "Please check your date of birth.");
      return;
    }

    setIsSubmitting(true);

    try {
      await setDob(isoDate);
      await fetchUser();
      router.replace("/(onboarding)/consent");
    } catch (err) {
      const apiError = normalizeError(err);
      if (apiError.code === "AGE_RESTRICTED" || apiError.status === 403) {
        // BR-01: Under 18 hard reject, user deleted on backend
        setIsUnder18Blocked(true);
      } else if (apiError.code === "DOB_IMMUTABLE") {
        setError("Date of birth has already been set.");
      } else {
        setError(apiError.message || "Failed to set date of birth. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissBlocked = async () => {
    setIsUnder18Blocked(false);
    await logout();
    router.replace("/(auth)/welcome");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>When is your birthday?</Text>
        <Text style={styles.subtitle}>
          Proxi is strictly for adults aged 18 and older. Your date of birth cannot be changed
          once saved.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputsRow}>
          <View style={styles.inputColSmall}>
            <Text style={styles.inputLabel}>Day</Text>
            <TextInput
              style={styles.input}
              placeholder="DD"
              placeholderTextColor="#5C6378"
              keyboardType="number-pad"
              maxLength={2}
              value={day}
              onChangeText={(text) => {
                setDay(text);
                if (error) setError(null);
              }}
              testID="dob-day-input"
            />
          </View>

          <View style={styles.inputColSmall}>
            <Text style={styles.inputLabel}>Month</Text>
            <TextInput
              style={styles.input}
              placeholder="MM"
              placeholderTextColor="#5C6378"
              keyboardType="number-pad"
              maxLength={2}
              value={month}
              onChangeText={(text) => {
                setMonth(text);
                if (error) setError(null);
              }}
              testID="dob-month-input"
            />
          </View>

          <View style={styles.inputColLarge}>
            <Text style={styles.inputLabel}>Year</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY"
              placeholderTextColor="#5C6378"
              keyboardType="number-pad"
              maxLength={4}
              value={year}
              onChangeText={(text) => {
                setYear(text);
                if (error) setError(null);
              }}
              testID="dob-year-input"
            />
          </View>
        </View>

        {error && (
          <Text style={styles.errorText} testID="dob-error-text">
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          testID="dob-submit-button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Confirm Date of Birth</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Under 18 Hard Blocking Modal */}
      <Modal visible={isUnder18Blocked} transparent animationType="fade">
        <View style={styles.modalOverlay} testID="dob-blocked-modal">
          <View style={styles.modalBox}>
            <Text style={styles.modalIcon}>🔞</Text>
            <Text style={styles.modalTitle}>Age Requirement Not Met</Text>
            <Text style={styles.modalMessage}>
              You must be 18 or older to use Proxi. Your account has been closed in accordance
              with safety rules.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleDismissBlocked}
              testID="dob-blocked-dismiss-button"
            >
              <Text style={styles.modalButtonText}>Understand & Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1117",
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E94A5",
    lineHeight: 20,
  },
  form: {
    width: "100%",
  },
  inputsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  inputColSmall: {
    width: "28%",
  },
  inputColLarge: {
    width: "38%",
  },
  inputLabel: {
    color: "#8E94A5",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1A1E2B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2B3245",
    color: "#FFFFFF",
    fontSize: 18,
    textAlign: "center",
    height: 56,
    fontWeight: "600",
  },
  errorText: {
    color: "#FF4D4F",
    fontSize: 13,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#E94057",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#1A1E2B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FF4D4F",
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    color: "#8E94A5",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#FF4D4F",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
