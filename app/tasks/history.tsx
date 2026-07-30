import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useActivity } from '@/hooks/useActivity';
import { describeActivityEvent } from '@/lib/activityEvent';

const PAGE_SIZE = 10;
const BAR_GREEN = '#206E56';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function HistoryScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { events, totalPages, totalCount, isLoading, hasMore, error } = useActivity({
    page,
    pageSize: PAGE_SIZE,
  });

  // Page-number row to render (always 1..totalPages — fine on mobile up to ~10
  // pages; ellipsis pattern can land later if datasets grow).
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  const isLastPage = !hasMore;
  const isEmpty = totalCount === 0 && !isLoading;
  const showEndCopy = !isLoading && events.length > 0 && isLastPage;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Table header */}
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.cellDate, styles.headerCell]}>Date</Text>
          <Text style={[styles.cellTarget, styles.headerCell]}>Restaurant</Text>
          <Text style={[styles.cellStatus, styles.headerCell]}>Status</Text>
        </View>

        {/* Body */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : isLoading && events.length === 0 ? (
          <ActivityIndicator color={BAR_GREEN} style={styles.loader} />
        ) : isEmpty ? (
          <Text style={styles.emptyText}>No activity yet.</Text>
        ) : (
          events.map((event, i) => {
            const row = describeActivityEvent(event);
            const date = formatDate(event.event_at);
            return (
              <View key={`${event.event_type}-${event.event_at}-${i}`} style={styles.tableRow}>
                <Text style={styles.cellDate}>{date}</Text>
                <Text style={styles.cellTarget} numberOfLines={2}>
                  {row.target}
                </Text>
                <View style={styles.cellStatus}>
                  {row.status && (
                    <Text
                      style={[
                        styles.statusText,
                        row.status.tone === 'approved' && { color: BAR_GREEN },
                        row.status.tone === 'rejected' && { color: '#EF4444' },
                        row.status.tone === 'pending' && { color: '#B45309' },
                      ]}
                    >
                      {row.status.text}
                    </Text>
                  )}
                  {row.trailing && (
                    <Text style={styles.trailingText}>{row.trailing.text}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {showEndCopy && (
          <Text style={styles.endText}>You&apos;ve reached the end!</Text>
        )}
      </ScrollView>

      {/* Pagination footer — only when there's something to paginate */}
      {totalPages > 1 && (
        <View style={styles.paginationBar}>
          <TouchableOpacity
            style={[styles.pageNav, page === 1 && styles.pageNavDisabled]}
            onPress={() => page > 1 && setPage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft size={18} color={page === 1 ? '#CBD5E1' : '#0F172A'} />
            <Text style={[styles.pageNavText, page === 1 && styles.pageNavTextDisabled]}>
              Prev
            </Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pageNumbers}
          >
            {pageNumbers.map((n) => {
              const active = n === page;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.pageDot, active && styles.pageDotActive]}
                  onPress={() => setPage(n)}
                  disabled={active}
                >
                  <Text style={[styles.pageDotText, active && styles.pageDotTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.pageNav, !hasMore && styles.pageNavDisabled]}
            onPress={() => hasMore && setPage(page + 1)}
            disabled={!hasMore}
          >
            <Text style={[styles.pageNavText, !hasMore && styles.pageNavTextDisabled]}>
              Next
            </Text>
            <ChevronRight size={18} color={!hasMore ? '#CBD5E1' : '#0F172A'} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  tableHeaderRow: {
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  cellDate: {
    width: 70,
    fontSize: 13,
    color: '#475569',
  },
  cellTarget: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  cellStatus: {
    width: 90,
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  trailingText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    paddingVertical: 32,
  },
  loader: {
    paddingVertical: 32,
  },
  endText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  pageNavDisabled: {
    opacity: 0.5,
  },
  pageNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  pageNavTextDisabled: {
    color: '#CBD5E1',
  },
  pageNumbers: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  pageDot: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  pageDotActive: {
    backgroundColor: BAR_GREEN,
  },
  pageDotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pageDotTextActive: {
    color: '#FFFFFF',
  },
});
