import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { createRideQr, createSelfPayQr, getQrStatus, UpiQr } from '../lib/upiQr';
import { formatRupees } from '../lib/formatters';

export type UpiQrRequest =
  | { kind: 'ride'; bookingId: string }
  | { kind: 'cash_deposit' | 'commission'; driverId: string; amount: number };

interface Props {
  /** Collect a ride fare (shorthand for request {kind:'ride'}). */
  bookingId?: string | null;
  request?: UpiQrRequest | null;
  title?: string;
  onClose: () => void;
  onPaid: () => void;
}

export function UpiQrModal({ bookingId, request, title, onClose, onPaid }: Props) {
  const req: UpiQrRequest | null = request ?? (bookingId ? { kind: 'ride', bookingId } : null);
  const reqKey = req ? JSON.stringify(req) : null;
  const [qr, setQr] = useState<UpiQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paidRef = useRef(false);

  useEffect(() => {
    if (!req) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    paidRef.current = false;
    setQr(null);
    setError(null);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Please sign in again.');
        const created =
          req.kind === 'ride'
            ? await createRideQr(req.bookingId, token)
            : await createSelfPayQr(req.kind, req.driverId, req.amount, token);
        if (stop) return;
        setQr(created);
        // A payment link (paying from this phone) opens the UPI app straight away.
        if (created.id.startsWith('plink_')) Linking.openURL(created.image_url).catch(() => {});
        const poll = async () => {
          if (stop) return;
          try {
            const latest = await getQrStatus(created.id, token);
            if (stop) return;
            setQr(latest);
            if (latest.status === 'paid') {
              if (!paidRef.current) {
                paidRef.current = true;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onPaid();
              }
              return;
            }
            if (latest.status === 'closed') return;
          } catch {
            // network blip: keep polling
          }
          timer = setTimeout(poll, 4000);
        };
        timer = setTimeout(poll, 4000);
      } catch (e: any) {
        if (!stop) setError(e?.message || 'Could not create the QR code.');
      }
    })();

    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title || 'Collect fare by UPI'}</Text>
          <Text style={styles.sub}>
            {req?.kind === 'ride' || !req
              ? 'Passenger scans with any UPI app. Paid straight to Orange Taxi.'
              : 'Scan with any UPI app on your phone. Paid straight to Orange Taxi and recorded automatically.'}
          </Text>

          {error ? (
            <View style={styles.center}>
              <XCircle size={44} color="#EF4444" />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : !qr ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : qr.status === 'paid' ? (
            <View style={styles.center}>
              <CheckCircle size={64} color="#10B981" />
              <Text style={styles.success}>Payment received</Text>
              <Text style={styles.sub}>
                ₹{formatRupees(qr.amount)} paid by UPI.{req?.kind === 'ride' ? ' Do not collect cash.' : ''}
              </Text>
            </View>
          ) : qr.status === 'closed' ? (
            <View style={styles.center}>
              <XCircle size={44} color="#9CA3AF" />
              <Text style={styles.sub}>This QR expired. Close and try again.</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.amount}>₹{formatRupees(qr.amount)}</Text>
              {qr.id.startsWith('plink_') ? (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#F97316', paddingHorizontal: 20 }]}
                  onPress={() => Linking.openURL(qr.image_url).catch(() => {})}
                >
                  <Text style={styles.btnText}>OPEN UPI PAYMENT</Text>
                </TouchableOpacity>
              ) : (
                <Image source={{ uri: qr.image_url }} style={styles.qr} resizeMode="contain" />
              )}
              <View style={styles.waitRow}>
                <ActivityIndicator size="small" color="#6B7280" />
                <Text style={styles.sub}>  Waiting for payment…</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, qr?.status === 'paid' && { backgroundColor: '#10B981' }]}
            onPress={onClose}
          >
            <Text style={styles.btnText}>{qr?.status === 'paid' ? 'DONE' : 'CLOSE'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  sub: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 4 },
  center: { alignItems: 'center', paddingVertical: 16, minHeight: 120, justifyContent: 'center' },
  amount: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  qr: { width: 260, height: 360, backgroundColor: '#FFFFFF' },
  waitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  success: { fontSize: 18, fontWeight: '800', color: '#10B981', marginTop: 8 },
  error: { fontSize: 13, color: '#EF4444', textAlign: 'center', marginTop: 8 },
  btn: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 1 },
});
