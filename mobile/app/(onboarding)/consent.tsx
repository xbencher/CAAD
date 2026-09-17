import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { grantConsent } from "../../src/api/auth";
import { normalizeError } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";

export default function ConsentScreen(): React.JSX.Element {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { fetchUser } = useAuthStore();
  const router = useRouter();

  const isFormValid = termsAccepted && privacyAccepted;

  const handleAgreeAndContinue = async () => {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Grant terms and privacy version 1.0
      await grantConsent("terms", "1.0");
      await grantConsent("privacy", "1.0");
      await fetchUser();
      router.replace("/(onboarding)/profile");
    } catch (err) {
      const apiError = normalizeError(err);
      setError(apiError.message || "Failed to record your consents. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="consent-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Legal & Privacy</Text>
        <Text style={styles.subtitle}>
          Please review and accept our Terms of Service and Privacy Policy to continue using Proxi.
        </Text>
      </View>

      <View style={styles.content}>
        {/* Terms Card */}
        <View style={styles.consentCard}>
          <View style={styles.consentInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.consentTitle}>Terms of Service</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v1.0</Text>
              </View>
            </View>
            <Text style={styles.consentDescription}>
              I agree to the Community Guidelines, safety rules, and acceptable use policy.
            </Text>
          </View>
          <Switch
            value={termsAccepted}
            onValueChange={(val) => {
              setTermsAccepted(val);
              if (error) setError(null);
            }}
            trackColor={{ false: "#2B3245", true: "#E94057" }}
            thumbColor="#FFFFFF"
            testID="consent-terms-toggle"
          />
        </View>

        {/* Privacy Card */}
        <View style={styles.consentCard}>
          <View style={styles.consentInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.consentTitle}>Privacy Policy</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v1.0</Text>
              </View>
            </View>
            <Text style={styles.consentDescription}>
              I consent to venue-based presence discovery and privacy-preserving data practices.
            </Text>
          </View>
          <Switch
            value={privacyAccepted}
            onValueChange={(val) => {
              setPrivacyAccepted(val);
              if (error) setError(null);
            }}
            trackColor={{ false: "#2B3245", true: "#E94057" }}
            thumbColor="#FFFFFF"
            testID="consent-privacy-toggle"
          />
        </View>

        {error && (
          <Text style={styles.errorText} testID="consent-error-text">
            {error}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!isFormValid || isSubmitting) && styles.buttonDisabled]}
          onPress={handleAgreeAndContinue}
          disabled={!isFormValid || isSubmitting}
          testID="consent-submit-button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Agree & Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1117",
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 40,
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
  content: {
    flex: 1,
  },
  consentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1E2B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3245",
    padding: 18,
    marginBottom: 16,
  },
  consentInfo: {
    flex: 1,
    marginRight: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 8,
  },
  versionBadge: {
    backgroundColor: "#2B3245",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionText: {
    fontSize: 11,
    color: "#8E94A5",
    fontWeight: "600",
  },
  consentDescription: {
    fontSize: 13,
    color: "#8E94A5",
    lineHeight: 18,
  },
  errorText: {
    color: "#FF4D4F",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  footer: {
    width: "100%",
  },
  button: {
    backgroundColor: "#E94057",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
