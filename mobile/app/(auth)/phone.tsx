import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { requestOtp } from "../../src/api/auth";
import { normalizeError } from "../../src/api/client";

export function validateIndianPhoneDigits(digits: string): string | null {
  const cleaned = digits.trim().replace(/\D/g, "");
  if (!cleaned) {
    return "Phone number is required.";
  }
  if (!/^[6-9]/.test(cleaned)) {
    return "Mobile number must start with 6, 7, 8, or 9.";
  }
  if (cleaned.length !== 10) {
    return "Mobile number must be exactly 10 digits.";
  }
  return null;
}

export default function PhoneScreen(): React.JSX.Element {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSendOtp = async () => {
    setError(null);
    const validationError = validateIndianPhoneDigits(digits);
    if (validationError) {
      setError(validationError);
      return;
    }

    const fullPhone = `+91${digits.trim().replace(/\D/g, "")}`;
    setIsSubmitting(true);

    try {
      await requestOtp(fullPhone);
      router.push({
        pathname: "/(auth)/otp",
        params: { phone: fullPhone },
      });
    } catch (err) {
      const apiError = normalizeError(err);
      if (apiError.code === "RATE_LIMITED") {
        setError("Too many requests. Please wait a few minutes before trying again.");
      } else {
        setError(apiError.message || "Failed to send OTP. Please check your number.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Enter your phone</Text>
        <Text style={styles.subtitle}>
          We&apos;ll send a 6-digit verification code to this number.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
          <View style={styles.countryCodeBadge}>
            <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="98765 43210"
            placeholderTextColor="#5C6378"
            keyboardType="phone-pad"
            maxLength={10}
            value={digits}
            onChangeText={(text) => {
              setDigits(text);
              if (error) {
                setError(null);
              }
            }}
            testID="phone-input"
            accessibilityLabel="Phone number input"
            autoFocus
          />
        </View>

        {error && (
          <Text style={styles.errorText} testID="phone-error-text">
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={isSubmitting}
          testID="send-otp-button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>
      </View>
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1E2B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2B3245",
    paddingHorizontal: 12,
    height: 56,
  },
  inputRowError: {
    borderColor: "#FF4D4F",
  },
  countryCodeBadge: {
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: "#2B3245",
    marginRight: 10,
  },
  countryCodeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 18,
    letterSpacing: 1,
  },
  errorText: {
    color: "#FF4D4F",
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  button: {
    backgroundColor: "#E94057",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
