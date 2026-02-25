import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { api } from "../api/client";
import { formatDateInAppTimeZone } from "../utils/timezone";

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/payments/me")
      .then((res) => setPayments(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Payments are managed by admin</Text>
        <Text style={styles.noticeText}>Use this screen to review payment history only.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>${(item.amount / 100).toFixed(2)} - {item.method}</Text>
              <Text style={styles.subText}>{formatDateInAppTimeZone(item.date)}</Text>
              <Text style={styles.subText}>{item.status}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
    padding: 16
  },
  noticeCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  noticeTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
    marginBottom: 4
  },
  noticeText: {
    color: "#94A3B8"
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  cardTitle: {
    color: "#F8FAFC",
    fontWeight: "600"
  },
  subText: {
    color: "#94A3B8"
  }
});
