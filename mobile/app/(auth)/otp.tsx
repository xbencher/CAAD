import React, { useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";

import { requestOtp, verifyOtp } from "../../src/api/auth";
import { normalizeError } from "../../src/api/client";
import { getDeviceId } from "../../src/lib/tokens";
import { useAuthStore } from "../../src/store/auth";

export default function OtpScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ phone: string }>();
  const phone = params.phone ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const inputRef = useRef<TextInput>(null);

  const { login } = useAuthStore();
  const router = useRouter();

  // Resend countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const submitOtp = async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || isSubmitting || isLocked) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const deviceId = await getDeviceId();
      const response = await verifyOtp(phone, codeToVerify, deviceId);
      await login(response.access_token, response.refresh_token);
      // RouteGuard will handle navigating to either (onboarding) or (app)/tabs
    } catch (err) {
      const apiError = normalizeError(err);
      if (apiError.code === "OTP_LOCKED" || apiError.status === 429) {
        setIsLocked(true);
        setError("Too many incorrect attempts. Please request a new code.");
      } else {
        setError(apiError.message || "Invalid verification code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 6);
    setCode(cleaned);
    if (error) {
      setError(null);
    }
    if (cleaned.length === 6) {
      submitOtp(cleaned);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || isSubmitting) {
      return;
    }
    setError(null);
    setIsLocked(false);
    setCode("");
    setIsSubmitting(true);
    try {
      await requestOtp(phone);
      setSecondsLeft(60);
    } catch (err) {
      const apiError = normalizeError(err);
      setError(apiError.message || "Failed to resend code.");
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          testID="otp-back-button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verify Code</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to <Text style={styles.phoneHighlight}>{phone}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={handleCodeChange}
          testID="otp-input"
          autoFocus
        />

        {/* 6-box visual representation */}
        <TouchableOpacity
          style={styles.codeContainer}
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const digit = code[index] || "";
            const isFocused = code.length === index;
            return (
              <View
                key={index}
                style={[
                  styles.codeBox,
                  isFocused && styles.codeBoxFocused,
                  error ? styles.codeBoxError : null,
                ]}
              >
                <Text style={styles.codeDigit}>{digit}</Text>
              </View>
            );
          })}
        </TouchableOpacity>

        {error && (
          <Text style={styles.errorText} testID="otp-error-text">
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (code.length !== 6 || isSubmitting || isLocked) && styles.buttonDisabled,
          ]}
          onPress={() => submitOtp(code)}
          disabled={code.length !== 6 || isSubmitting || isLocked}
          testID="verify-otp-button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          {secondsLeft > 0 ? (
            <Text style={styles.countdownText} testID="countdown-text">
              Resend code in {secondsLeft}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} testID="resend-otp-button">
              <Text style={styles.resendText}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1117",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 36,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: "#8E94A5",
    fontSize: 16,
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
  phoneHighlight: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  form: {
    width: "100%",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#1A1E2B",
    borderWidth: 1,
    borderColor: "#2B3245",
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxFocused: {
    borderColor: "#E94057",
  },
  codeBoxError: {
    borderColor: "#FF4D4F",
  },
  codeDigit: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorText: {
    color: "#FF4D4F",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#E94057",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  resendRow: {
    marginTop: 24,
    alignItems: "center",
  },
  countdownText: {
    color: "#5C6378",
    fontSize: 14,
  },
  resendText: {
    color: "#E94057",
    fontSize: 14,
    fontWeight: "600",
  },
});
